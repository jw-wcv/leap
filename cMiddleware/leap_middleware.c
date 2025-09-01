#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>              // for close() and usleep()
#include <pthread.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <errno.h>

#include "LeapC.h"  // LeapC SDK header from Ultraleap

// Configuration: use a TCP socket on localhost port 8000 for communication
#define SERVER_PORT 8000

// Global variables for LeapC connection and socket
static LEAP_CONNECTION leapConnection;
static volatile int running = 0;
static int clientSock = -1;  // Client socket (set after accept), -1 if not connected

// Utility: Convert LeapC result codes to string for logging
const char* ResultString(eLeapRS r) {
    switch(r) {
        case eLeapRS_Success:                  return "eLeapRS_Success";
        case eLeapRS_UnknownError:             return "eLeapRS_UnknownError";
        case eLeapRS_InvalidArgument:          return "eLeapRS_InvalidArgument";
        case eLeapRS_InsufficientResources:    return "eLeapRS_InsufficientResources";
        case eLeapRS_InsufficientBuffer:       return "eLeapRS_InsufficientBuffer";
        case eLeapRS_Timeout:                  return "eLeapRS_Timeout";
        case eLeapRS_NotConnected:             return "eLeapRS_NotConnected";
        case eLeapRS_HandshakeIncomplete:      return "eLeapRS_HandshakeIncomplete";
        case eLeapRS_BufferSizeOverflow:       return "eLeapRS_BufferSizeOverflow";
        case eLeapRS_ProtocolError:            return "eLeapRS_ProtocolError";
        case eLeapRS_InvalidClientID:          return "eLeapRS_InvalidClientID";
        case eLeapRS_UnexpectedClosed:         return "eLeapRS_UnexpectedClosed";
        case eLeapRS_UnknownImageFrameRequest: return "eLeapRS_UnknownImageFrameRequest";
        case eLeapRS_UnknownTrackingFrameID:   return "eLeapRS_UnknownTrackingFrameID";
        case eLeapRS_RoutineIsNotSeer:         return "eLeapRS_RoutineIsNotSeer";
        case eLeapRS_TimestampTooEarly:        return "eLeapRS_TimestampTooEarly";
        case eLeapRS_ConcurrentPoll:           return "eLeapRS_ConcurrentPoll";
        case eLeapRS_NotAvailable:             return "eLeapRS_NotAvailable";
        case eLeapRS_NotStreaming:             return "eLeapRS_NotStreaming";
        case eLeapRS_CannotOpenDevice:         return "eLeapRS_CannotOpenDevice";
        default:                               return "UnknownResult";
    }
}

// Thread function: Poll the LeapC connection and send tracking data to client
void* leapTrackingLoop(void* unused) {
    // Names for each finger index (to label JSON fields)
    const char* fingerNames[5] = { "thumb", "index", "middle", "ring", "pinky" };

    // Poll for messages while running flag is true
    while (running) {
        LEAP_CONNECTION_MESSAGE msg;
        eLeapRS res = LeapPollConnection(leapConnection, 1000, &msg);
        if (res != eLeapRS_Success) {
            if (res == eLeapRS_Timeout) {
                // No new message within timeout; continue polling
                continue;
            }
            fprintf(stderr, "LeapPollConnection error: %s\n", ResultString(res));
            // If not connected or other error, continue and hope it resolves (or will get a ConnectionLost event)
            continue;
        }

        // Handle different event types
        switch (msg.type) {
            case eLeapEventType_Connection:
                printf("LeapC: Connected to Leap service.\n");
                break;
            case eLeapEventType_ConnectionLost:
                fprintf(stderr, "LeapC: Connection to Leap service lost.\n");
                running = 0;  // stop running loop on lost connection
                break;
            case eLeapEventType_Device:
                // A device (Leap Motion) was found – we could query device info here if needed
                printf("LeapC: Device connected.\n");
                break;
            case eLeapEventType_DeviceLost:
                fprintf(stderr, "LeapC: Device disconnected.\n");
                // We keep running to allow for device re-connection
                break;
            case eLeapEventType_Tracking: {
                // Tracking data for a frame is available
                const LEAP_TRACKING_EVENT* frame = msg.tracking_event;
                // Format and send data if a client is connected
                if (clientSock >= 0 && frame) {
                    // Build JSON string for this frame’s data
                    char json[1024];
                    int len = 0;
                    // Start JSON object with frame ID and open hands array
                    long long frameId = (long long)frame->tracking_frame_id;
                    len += snprintf(json + len, sizeof(json) - len,
                                    "{\"frameId\": %lld, \"hands\": [", frameId);
                    // Iterate through hands in frame
                    for (uint32_t h = 0; h < frame->nHands && len < (int)sizeof(json); ++h) {
                        const LEAP_HAND* hand = &frame->pHands[h];
                        // Determine hand type as string
                        const char* handType = (hand->type == eLeapHandType_Left ? "left" : "right");
                        // Open hand object in JSON
                        len += snprintf(json + len, sizeof(json) - len,
                                        "{\"id\": %u, \"type\": \"%s\", \"palmPosition\": [%.2f, %.2f, %.2f], \"fingers\": {",
                                        hand->id, handType,
                                        hand->palm.position.x, hand->palm.position.y, hand->palm.position.z);
                        // Add each finger's tip position
                        // (distal bone end is the finger tip)
                        for (int f = 0; f < 5 && len < (int)sizeof(json); ++f) {
                            LEAP_VECTOR tip = hand->digits[f].distal.next_joint;
                            len += snprintf(json + len, sizeof(json) - len,
                                            "\"%s\": [%.1f, %.1f, %.1f]%s",
                                            fingerNames[f],
                                            tip.x, tip.y, tip.z,
                                            (f < 4 ? ", " : ""));
                        }
                        // Close fingers object and hand object, add comma if more hands follow
                        len += snprintf(json + len, sizeof(json) - len,
                                        "}%s", (h < frame->nHands - 1 ? "}," : "}"));
                    }
                    // Close hands array and JSON object
                    len += snprintf(json + len, sizeof(json) - len, "]}\n");

                    // Send the JSON string to the Node.js client
                    if (len > 0) {
                        ssize_t sent = send(clientSock, json, len, 0);
                        if (sent < 0) {
                            // Socket error (e.g., client disconnected)
                            perror("Send error");
                            // Stop running if client is gone; break out to end thread
                            running = 0;
                        }
                    }
                }
                break;
            }
            default:
                // We ignore other event types in this example (images, policy, etc.)
                break;
        } // end switch
    } // end while

    return NULL;
}

int main(int argc, char** argv) {
    eLeapRS result;

    // 1. Initialize LeapC connection to the tracking service
    result = LeapCreateConnection(NULL, &leapConnection);
    if (result != eLeapRS_Success) {
        fprintf(stderr, "ERROR: LeapCreateConnection failed (%s)\n", ResultString(result));
        return EXIT_FAILURE;
    }
    result = LeapOpenConnection(leapConnection);
    if (result != eLeapRS_Success) {
        fprintf(stderr, "ERROR: LeapOpenConnection failed (%s)\n", ResultString(result));
        return EXIT_FAILURE;
    }

    // 2. Start the LeapC polling thread
    running = 1;
    pthread_t leapThread;
    if (pthread_create(&leapThread, NULL, leapTrackingLoop, NULL) != 0) {
        fprintf(stderr, "ERROR: Could not create thread for LeapC polling\n");
        return EXIT_FAILURE;
    }

    // 3. Set up TCP socket server for local IPC
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        perror("socket() failed");
        return EXIT_FAILURE;
    }
    // Allow immediate reuse of the port if the program restarts
    int optval = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &optval, sizeof(optval));

    struct sockaddr_in serv_addr;
    memset(&serv_addr, 0, sizeof(serv_addr));
    serv_addr.sin_family = AF_INET;
    serv_addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);  // 127.0.0.1
    serv_addr.sin_port = htons(SERVER_PORT);

    if (bind(server_fd, (struct sockaddr*)&serv_addr, sizeof(serv_addr)) < 0) {
        perror("bind() failed");
        close(server_fd);
        return EXIT_FAILURE;
    }
    if (listen(server_fd, 1) < 0) {
        perror("listen() failed");
        close(server_fd);
        return EXIT_FAILURE;
    }
    printf("LeapC middleware: Listening for a client on localhost:%d...\n", SERVER_PORT);

    // 4. Accept a single client connection (Node.js client)
    struct sockaddr_in client_addr;
    socklen_t client_len = sizeof(client_addr);
    clientSock = accept(server_fd, (struct sockaddr*)&client_addr, &client_len);
    if (clientSock < 0) {
        perror("accept() failed");
        // Terminate the program if no client can connect
        running = 0;
    } else {
        printf("Client connected. Streaming hand tracking data...\n");
    }

    // 5. Wait for the LeapC thread to finish (will exit when `running` becomes 0)
    pthread_join(leapThread, NULL);

    // 6. Cleanup: close sockets and LeapC connection
    if (clientSock >= 0) close(clientSock);
    close(server_fd);
    LeapCloseConnection(leapConnection);
    LeapDestroyConnection(leapConnection);
    printf("LeapC middleware terminated.\n");
    return 0;
}
