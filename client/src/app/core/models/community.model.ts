/** Community + discussion models (Phase 4 · B9) — mirror the server community contract. */
export type ChannelKind = 'discussion' | 'help' | 'showcase';
export type ThreadKind = 'discussion' | 'question' | 'showcase';

export interface CommunityChannel {
  id: string;
  name: string;
  slug: string;
  description: string;
  kind: ChannelKind;
  threadCount: number;
}

export interface CommunityThread {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  kind: ThreadKind;
  tags: string[];
  projectId?: string;
  projectTitle?: string;
  upvotes: number;
  hasUpvoted: boolean;
  replyCount: number;
  resolved: boolean;
  pinned: boolean;
  createdAt: string;
}

export interface CommunityReply {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  upvotes: number;
  hasUpvoted: boolean;
  isAnswer: boolean;
  createdAt: string;
}

export interface ThreadWithReplies {
  thread: CommunityThread;
  replies: CommunityReply[];
}

export interface CreateThreadRequest {
  channelId: string;
  title: string;
  body?: string;
  kind?: ThreadKind;
  tags?: string[];
  projectId?: string;
}
