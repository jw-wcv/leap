// leap_middleware.c
#include <stdarg.h> 
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>              // close(), usleep()
#include <pthread.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <errno.h>

#include "LeapC.h"  // Ultraleap LeapC SDK

// --------------------- Config ---------------------
#define SERVER_PORT 8000
#define JSON_BUF_SZ 8192          // generous to avoid overflow
#define SEND_CHECK(x) if ((x) < 0) { perror("Send error"); running = 0; }

// --------------------- Globals --------------------
static LEAP_CONNECTION leapConnection;
static volatile int running = 0;
static int clientSock = -1;

// --------------------- Util -----------------------
static const char* ResultString(eLeapRS r){
  switch(r){
    case eLeapRS_Success: return "eLeapRS_Success";
    case eLeapRS_UnknownError: return "eLeapRS_UnknownError";
    case eLeapRS_InvalidArgument: return "eLeapRS_InvalidArgument";
    case eLeapRS_InsufficientResources: return "eLeapRS_InsufficientResources";
    case eLeapRS_InsufficientBuffer: return "eLeapRS_InsufficientBuffer";
    case eLeapRS_Timeout: return "eLeapRS_Timeout";
    case eLeapRS_NotConnected: return "eLeapRS_NotConnected";
    case eLeapRS_HandshakeIncomplete: return "eLeapRS_HandshakeIncomplete";
    case eLeapRS_BufferSizeOverflow: return "eLeapRS_BufferSizeOverflow";
    case eLeapRS_ProtocolError: return "eLeapRS_ProtocolError";
    case eLeapRS_InvalidClientID: return "eLeapRS_InvalidClientID";
    case eLeapRS_UnexpectedClosed: return "eLeapRS_UnexpectedClosed";
    case eLeapRS_UnknownImageFrameRequest: return "eLeapRS_UnknownImageFrameRequest";
    case eLeapRS_UnknownTrackingFrameID: return "eLeapRS_UnknownTrackingFrameID";
    case eLeapRS_RoutineIsNotSeer: return "eLeapRS_RoutineIsNotSeer";
    case eLeapRS_TimestampTooEarly: return "eLeapRS_TimestampTooEarly";
    case eLeapRS_ConcurrentPoll: return "eLeapRS_ConcurrentPoll";
    case eLeapRS_NotAvailable: return "eLeapRS_NotAvailable";
    case eLeapRS_NotStreaming: return "eLeapRS_NotStreaming";
    case eLeapRS_CannotOpenDevice: return "eLeapRS_CannotOpenDevice";
    default: return "UnknownResult";
  }
}

// safe append into json buffer
static inline void jappend(char* json, int* len, const char* fmt, ...) {
  if (*len >= JSON_BUF_SZ) return;
  va_list ap; va_start(ap, fmt);
  int n = vsnprintf(json + *len, JSON_BUF_SZ - *len, fmt, ap);
  va_end(ap);
  if (n > 0) *len += (n > (JSON_BUF_SZ - *len) ? (JSON_BUF_SZ - *len) : n);
}

// ------------------- Polling Thread ---------------
static void* leapTrackingLoop(void* unused) {
  const char* fingerNames[5] = {"thumb","index","middle","ring","pinky"};

  while (running) {
    LEAP_CONNECTION_MESSAGE msg;
    eLeapRS res = LeapPollConnection(leapConnection, 1000, &msg);
    if (res != eLeapRS_Success) {
      if (res == eLeapRS_Timeout) continue;
      fprintf(stderr, "LeapPollConnection error: %s\n", ResultString(res));
      continue;
    }

    switch (msg.type) {
      case eLeapEventType_Connection:
        printf("[LeapC] Connected to service.\n");
        fflush(stdout);
        break;

      case eLeapEventType_ConnectionLost:
        fprintf(stderr, "[LeapC] Connection lost.\n");
        running = 0;
        break;

      case eLeapEventType_Device:
        printf("[LeapC] Device connected.\n");
        fflush(stdout);
        break;

      case eLeapEventType_DeviceLost:
        fprintf(stderr, "[LeapC] Device disconnected.\n");
        break;

      case eLeapEventType_Tracking: {
        const LEAP_TRACKING_EVENT* frame = msg.tracking_event;
        if (clientSock < 0 || !frame) break;

        // ---------- LOG: frame summary ----------
        printf("[LeapC] Frame %lld: hands=%u\n",
               (long long)frame->tracking_frame_id, frame->nHands);
        for (uint32_t h = 0; h < frame->nHands; ++h) {
          const LEAP_HAND* hand = &frame->pHands[h];
          int extCount = 0;
          for (int f = 0; f < 5; ++f) extCount += !!hand->digits[f].is_extended;
          printf("  hand id=%u type=%s grab=%.2f pinch=%.2f ext=%d  extended:[%d %d %d %d %d]\n",
                 hand->id,
                 (hand->type == eLeapHandType_Left ? "left" : "right"),
                 hand->grab_strength, hand->pinch_strength, extCount,
                 (int)hand->digits[0].is_extended, (int)hand->digits[1].is_extended,
                 (int)hand->digits[2].is_extended, (int)hand->digits[3].is_extended,
                 (int)hand->digits[4].is_extended);
        }
        fflush(stdout);

        // ---------- JSON: send to Node bridge ----------
        char json[JSON_BUF_SZ];
        int len = 0;
        long long frameId = (long long)frame->tracking_frame_id;

        jappend(json, &len, "{\"frameId\": %lld, \"hands\": [", frameId);

        for (uint32_t h = 0; h < frame->nHands; ++h) {
          const LEAP_HAND* hand = &frame->pHands[h];
          const char* handType = (hand->type == eLeapHandType_Left ? "left" : "right");

          // open hand object
          jappend(json, &len,
            "{\"id\": %u, \"type\": \"%s\", "
            "\"palmPosition\": [%.2f, %.2f, %.2f], "
            "\"grab\": %.3f, \"pinch\": %.3f, "
            "\"fingers\": {",
            hand->id, handType,
            hand->palm.position.x, hand->palm.position.y, hand->palm.position.z,
            hand->grab_strength, hand->pinch_strength
          );

          // finger tips (arrays) — compatible with your current Node bridge
          for (int f = 0; f < 5; ++f) {
            LEAP_VECTOR tip = hand->digits[f].distal.next_joint;
            jappend(json, &len,
              "\"%s\": [%.1f, %.1f, %.1f]%s",
              fingerNames[f], tip.x, tip.y, tip.z, (f < 4 ? ", " : "")
            );
          }

          // close fingers object, add a parallel "fingerExtended" map (non-breaking)
          jappend(json, &len, "}, \"fingerExtended\": {");
          for (int f = 0; f < 5; ++f) {
            jappend(json, &len,
              "\"%s\": %s%s",
              fingerNames[f],
              hand->digits[f].is_extended ? "true" : "false",
              (f < 4 ? ", " : "")
            );
          }

          // close hand object
          jappend(json, &len, "}}%s", (h < frame->nHands - 1 ? "," : ""));
        }

        // close hands + frame
        jappend(json, &len, "]}\n");

        // send
        if (len > 0) {
          ssize_t sent = send(clientSock, json, len, 0);
          SEND_CHECK(sent);
        }
        break;
      }

      default: /* ignore other events */ break;
    }
  }
  return NULL;
}

// ---------------------- main() --------------------
int main(int argc, char** argv) {
  eLeapRS result = LeapCreateConnection(NULL, &leapConnection);
  if (result != eLeapRS_Success) {
    fprintf(stderr, "ERROR: LeapCreateConnection failed (%s)\n", ResultString(result));
    return EXIT_FAILURE;
  }
  result = LeapOpenConnection(leapConnection);
  if (result != eLeapRS_Success) {
    fprintf(stderr, "ERROR: LeapOpenConnection failed (%s)\n", ResultString(result));
    return EXIT_FAILURE;
  }

  running = 1;
  pthread_t leapThread;
  if (pthread_create(&leapThread, NULL, leapTrackingLoop, NULL) != 0) {
    fprintf(stderr, "ERROR: Could not create LeapC polling thread\n");
    return EXIT_FAILURE;
  }

  // TCP server
  int server_fd = socket(AF_INET, SOCK_STREAM, 0);
  if (server_fd < 0) { perror("socket() failed"); return EXIT_FAILURE; }
  int optval = 1; setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &optval, sizeof(optval));

  struct sockaddr_in serv_addr;
  memset(&serv_addr, 0, sizeof(serv_addr));
  serv_addr.sin_family = AF_INET;
  serv_addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK); // 127.0.0.1
  serv_addr.sin_port = htons(SERVER_PORT);

  if (bind(server_fd, (struct sockaddr*)&serv_addr, sizeof(serv_addr)) < 0) {
    perror("bind() failed"); close(server_fd); return EXIT_FAILURE;
  }
  if (listen(server_fd, 1) < 0) {
    perror("listen() failed"); close(server_fd); return EXIT_FAILURE;
  }
  printf("LeapC middleware: Listening on localhost:%d …\n", SERVER_PORT); fflush(stdout);

  struct sockaddr_in client_addr; socklen_t client_len = sizeof(client_addr);
  clientSock = accept(server_fd, (struct sockaddr*)&client_addr, &client_len);
  if (clientSock < 0) {
    perror("accept() failed");
    running = 0;
  } else {
    printf("Client connected. Streaming hand tracking data…\n"); fflush(stdout);
  }

  pthread_join(leapThread, NULL);

  if (clientSock >= 0) close(clientSock);
  close(server_fd);
  LeapCloseConnection(leapConnection);
  LeapDestroyConnection(leapConnection);
  printf("LeapC middleware terminated.\n"); fflush(stdout);
  return 0;
}
