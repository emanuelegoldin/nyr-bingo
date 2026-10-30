type JoinThreadWSMessage = {
  type: 'join-thread';
  body: {
    threadId: string;
  };
};

type ThreadRefreshMessage = {
  type: 'thread-refresh';
  body: {
    threadId: string;
  };
};