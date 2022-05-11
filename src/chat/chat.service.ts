import { Injectable, Logger } from "@nestjs/common";
import { RoomService } from "../room/room.service";
import { RoomEventType } from "../room/const/RoomEventType";
import { Between, Repository } from "typeorm";

import {
  ChatBody,
  Message,
  SystemBody,
} from "../room/dto/response/message.response";
import {
  UserAllReadyCanceledResponse,
  UserAllReadyResponse,
  UserJoinedResponse,
  UserLeaveByKickResponse,
  UserLeaveByVoteResponse,
  UserLeaveResponse,
} from "../room/dto/response/users.response";
import RoomChatEntity, {
  ChatMessageBuilder,
  SystemMessageBuilder,
} from "../room/entity/room-chat.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { UserService } from "../user/user.service";
import {
  OrderCheckedResponse,
  OrderDoneResponse,
  OrderFixedResponse,
} from "../room/dto/response/order.response";
import {
  KickVoteCreatedResponse,
  KickVoteFinishedResponse,
  ResetVoteCreatedResponse,
  ResetVoteFinishedResponse,
} from "../room/dto/response/vote.response";
import {
  ChatMessageResponse,
  SystemMessageResponse,
} from "../room/dto/response/chat.response";
import RoomUserView from "../room/dto/response/user-view.dto";
import { RoomGateway } from "../room/room.gateway";
import UserChatMetadataEntity from "./entity/user-chat-metadata.entity";

@Injectable()
export class ChatService {
  private readonly logger = new Logger("ChatService");

  private _createUserEventData(
    type: RoomEventType,
    roomId: string,
    userId: string
  ) {
    const messagePromise = this.chatRepository.save(
      new SystemMessageBuilder()
        .setRoom(roomId)
        .setType(type)
        .setMetadataId(userId)
        .build()
    );
    const userPromise = this.userService.findUserOrUnknownIfNotExist(userId);

    messagePromise
      .then((roomChat) => {
        this.logger.log({
          message: `[onChatEvent] RoomChat Entity created ${roomChat.id}`,
        });
      })
      .catch((e) => {
        this.logger.error("RoomChatEntity Entity 저장 실패", e);
      });

    return Promise.all([messagePromise, userPromise]);
  }

  constructor(
    private roomService: RoomService,
    private userService: UserService,
    private roomGateway: RoomGateway,
    @InjectRepository(RoomChatEntity)
    private chatRepository: Repository<RoomChatEntity>,
    @InjectRepository(UserChatMetadataEntity)
    private userChatMetadataRepository: Repository<UserChatMetadataEntity>
  ) {
    // 일반 채팅
    roomService.on(
      RoomEventType.CHAT,
      (roomId: string, userId: string, message: string) => {
        return this.onChatEvent(roomId, userId, message);
      }
    );

    // 입/퇴장 관련
    roomService.on(RoomEventType.USER_ENTER, async (roomId, userId) => {
      const [roomChat, user] = await this._createUserEventData(
        RoomEventType.USER_ENTER,
        roomId,
        userId
      );

      this.broadcastChat(
        roomId,
        SystemMessageResponse.from(roomChat, UserJoinedResponse.from(user))
      );

      const userChatMetadata = new UserChatMetadataEntity();
      userChatMetadata.userId = userId;
      userChatMetadata.roomId = roomId;
      userChatMetadata.chatStartId = roomChat.id;
      userChatMetadata.readToId = roomChat.id;
      await this.userChatMetadataRepository.save(userChatMetadata);
    });

    roomService.on(RoomEventType.USER_LEAVE, async (roomId, userId) => {
      const [roomChat, user] = await this._createUserEventData(
        RoomEventType.USER_LEAVE,
        roomId,
        userId
      );
      this.broadcastChat(
        roomId,
        SystemMessageResponse.from(roomChat, UserLeaveResponse.from(user))
      );
    });

    roomService.on(RoomEventType.USER_KICKED, async (roomId, userId) => {
      //TODO Api에 kicked 추가
      const [roomChat, user] = await this._createUserEventData(
        RoomEventType.USER_KICKED,
        roomId,
        userId
      );
      this.broadcastChat(
        roomId,
        SystemMessageResponse.from(roomChat, UserLeaveByKickResponse.from(user))
      );

      await this.userChatMetadataRepository.update(
        {
          roomId: roomId,
          userId: userId,
        },
        { chatEndId: roomChat.id }
      );
    });

    roomService.on(
      RoomEventType.USER_KICKED_BY_VOTE,
      async (roomId, userId) => {
        //TODO Api에 kicked 추가
        const [roomChat, user] = await this._createUserEventData(
          RoomEventType.USER_KICKED_BY_VOTE,
          roomId,
          userId
        );
        this.broadcastChat(
          roomId,
          SystemMessageResponse.from(
            roomChat,
            UserLeaveByVoteResponse.from(user)
          )
        );

        await this.userChatMetadataRepository.update(
          {
            roomId: roomId,
            userId: userId,
          },
          { chatEndId: roomChat.id }
        );
      }
    );

    // 레디 상태
    roomService.on(RoomEventType.ALL_READY, async (roomId) => {
      const roomChat = await this.chatRepository.save(
        new SystemMessageBuilder()
          .setRoom(roomId)
          .setType(RoomEventType.ALL_READY)
          .setMetadataId("empty")
          .build()
      );
      this.broadcastChat(
        roomId,
        SystemMessageResponse.from(roomChat, UserAllReadyResponse.from())
      );
    });

    roomService.on(RoomEventType.ALL_READY_CANCELED, async (roomId) => {
      const roomChat = await this.chatRepository.save(
        new SystemMessageBuilder()
          .setRoom(roomId)
          .setType(RoomEventType.ALL_READY_CANCELED)
          .setMetadataId("empty")
          .build()
      );
      this.broadcastChat(
        roomId,
        SystemMessageResponse.from(
          roomChat,
          UserAllReadyCanceledResponse.from()
        )
      );
    });

    // 진행 상태
    roomService.on(RoomEventType.ORDER_FIXED, async (roomId) => {
      const roomChat = await this.chatRepository.save(
        new SystemMessageBuilder()
          .setRoom(roomId)
          .setType(RoomEventType.ORDER_FIXED)
          .setMetadataId("empty")
          .build()
      );
      this.broadcastChat(
        roomId,
        SystemMessageResponse.from(roomChat, OrderFixedResponse.from())
      );
    });

    roomService.on(RoomEventType.ORDER_CHECKED, async (roomId) => {
      const roomChat = await this.chatRepository.save(
        new SystemMessageBuilder()
          .setRoom(roomId)
          .setType(RoomEventType.ORDER_CHECKED)
          .setMetadataId("empty")
          .build()
      );
      this.broadcastChat(
        roomId,
        SystemMessageResponse.from(roomChat, OrderCheckedResponse.from())
      );
    });

    roomService.on(RoomEventType.ORDER_DONE, async (roomId) => {
      const roomChat = await this.chatRepository.save(
        new SystemMessageBuilder()
          .setRoom(roomId)
          .setType(RoomEventType.ORDER_DONE)
          .setMetadataId("empty")
          .build()
      );
      this.broadcastChat(
        roomId,
        SystemMessageResponse.from(roomChat, OrderDoneResponse.from())
      );
    });

    // 투표 관련
    roomService.on(RoomEventType.KICK_VOTE_CREATED, async (vote) => {
      //TODO vote에 targetUser 없을수도있음
      const roomChat = await this.chatRepository.save(
        new SystemMessageBuilder()
          .setRoom(vote.roomId)
          .setType(RoomEventType.KICK_VOTE_CREATED)
          .setMetadataId(vote.id)
          .build()
      );
      this.broadcastChat(
        vote.roomId,
        SystemMessageResponse.from(roomChat, KickVoteCreatedResponse.from(vote))
      );
    });

    roomService.on(RoomEventType.KICK_VOTE_FINISHED, async (vote) => {
      const roomChat = await this.chatRepository.save(
        new SystemMessageBuilder()
          .setRoom(vote.roomId)
          .setType(RoomEventType.KICK_VOTE_FINISHED)
          .setMetadataId(vote.id)
          .build()
      );
      this.broadcastChat(
        vote.roomId,
        SystemMessageResponse.from(
          roomChat,
          KickVoteFinishedResponse.from(vote)
        )
      );
    });

    roomService.on(RoomEventType.RESET_VOTE_CREATED, async (vote) => {
      const roomChat = await this.chatRepository.save(
        new SystemMessageBuilder()
          .setRoom(vote.roomId)
          .setType(RoomEventType.RESET_VOTE_CREATED)
          .setMetadataId(vote.id)
          .build()
      );
      this.broadcastChat(
        vote.roomId,
        SystemMessageResponse.from(
          roomChat,
          ResetVoteCreatedResponse.from(vote)
        )
      );
    });

    roomService.on(RoomEventType.RESET_VOTE_FINISHED, async (vote) => {
      const roomChat = await this.chatRepository.save(
        new SystemMessageBuilder()
          .setRoom(vote.roomId)
          .setType(RoomEventType.RESET_VOTE_FINISHED)
          .setMetadataId(vote.id)
          .build()
      );
      this.broadcastChat(
        vote.roomId,
        SystemMessageResponse.from(
          roomChat,
          ResetVoteFinishedResponse.from(vote)
        )
      );
    });
  }

  async clear() {
    await Promise.all([
      this.chatRepository.clear(),
      this.userChatMetadataRepository.clear(),
    ]);
    this.logger.warn("Chat Repository cleared");
  }

  async getAllMessagesByRoomForUser(roomId: string, userId: string) {
    // const role = await this.roomService.getRoomRole(roomId, userId);
    const userChatMetadata = await this.userChatMetadataRepository.findOne({
      roomId: roomId,
      userId: userId,
    });

    const qb = this.chatRepository
      .createQueryBuilder("chat")
      .where("chat.roomId = :roomId", { roomId: roomId })
      .andWhere("chat.id >= :startId", {
        startId: userChatMetadata.chatStartId,
      });

    if (userChatMetadata.chatEndId) {
      qb.andWhere("chat.id <= :endId", { endId: userChatMetadata.chatEndId });
    }

    return qb.orderBy("chat.id", "ASC").getMany();
  }

  async getAllMessagesResponse(roomId: string, userId: string) {
    const roomChats = await this.getAllMessagesByRoomForUser(roomId, userId);

    const messagesPromise = roomChats.map(async (roomChat) => {
      let user, vote;
      switch (roomChat.type) {
        case RoomEventType.USER_ENTER:
          user = await this.userService.findUserOrUnknownIfNotExist(
            roomChat.eventMetadataId
          );
          return SystemMessageResponse.from(
            roomChat,
            UserJoinedResponse.from(user)
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.USER_KICKED:
          user = await this.userService.findUserOrUnknownIfNotExist(
            roomChat.eventMetadataId
          );
          return SystemMessageResponse.from(
            roomChat,
            UserLeaveByKickResponse.from(user)
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.USER_KICKED_BY_VOTE:
          user = await this.userService.findUserOrUnknownIfNotExist(
            roomChat.eventMetadataId
          );
          return SystemMessageResponse.from(
            roomChat,
            UserLeaveByVoteResponse.from(user)
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.USER_LEAVE:
          user = await this.userService.findUserOrUnknownIfNotExist(
            roomChat.eventMetadataId
          );
          return SystemMessageResponse.from(
            roomChat,
            UserLeaveResponse.from(user)
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.ALL_READY:
          return SystemMessageResponse.from(
            roomChat,
            UserAllReadyResponse.from()
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.ALL_READY_CANCELED:
          return SystemMessageResponse.from(
            roomChat,
            UserAllReadyCanceledResponse.from()
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.ORDER_FIXED:
          return SystemMessageResponse.from(
            roomChat,
            OrderFixedResponse.from()
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.ORDER_CHECKED:
          return SystemMessageResponse.from(
            roomChat,
            OrderCheckedResponse.from()
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.ORDER_DONE:
          return SystemMessageResponse.from(
            roomChat,
            OrderDoneResponse.from()
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.KICK_VOTE_CREATED:
          vote = await this.roomService.getVoteById(roomChat.eventMetadataId);
          return SystemMessageResponse.from(
            roomChat,
            KickVoteCreatedResponse.from(vote)
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.KICK_VOTE_FINISHED:
          vote = await this.roomService.getVoteById(roomChat.eventMetadataId);
          return SystemMessageResponse.from(
            roomChat,
            KickVoteFinishedResponse.from(vote)
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.RESET_VOTE_CREATED:
          vote = await this.roomService.getVoteById(roomChat.eventMetadataId);
          return SystemMessageResponse.from(
            roomChat,
            ResetVoteCreatedResponse.from(vote)
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.RESET_VOTE_FINISHED:
          vote = await this.roomService.getVoteById(roomChat.eventMetadataId);
          return SystemMessageResponse.from(
            roomChat,
            ResetVoteFinishedResponse.from(vote)
          ) as Message<SystemBody | ChatBody>;

        case RoomEventType.CHAT:
          user = await this.userService.findUserOrUnknownIfNotExist(
            roomChat.userId
          );
          return ChatMessageResponse.from(roomChat, {
            ...RoomUserView.from(user),
            message: roomChat.message,
          }) as Message<SystemBody | ChatBody>;
      }
    });

    return await Promise.all(messagesPromise);
  }

  async onChatEvent(roomId: string, userId: string, message: string) {
    const messagePromise = this.chatRepository.save(
      new ChatMessageBuilder()
        .setRoom(roomId)
        .setUser(userId)
        .setMessage(message)
        .build()
    );

    const userPromise = this.userService.findUserOrUnknownIfNotExist(userId);

    const [roomChat, user] = await Promise.all([messagePromise, userPromise]);
    this.logger.log({
      message: `[onChatEvent] RoomChatEntity created ${roomChat.id}`,
    });

    this.broadcastChat(
      roomId,
      ChatMessageResponse.from(roomChat, {
        ...RoomUserView.from(user),
        message: message,
      })
    );
  }

  private broadcastChat(
    roomId: string,
    message: Message<ChatBody | SystemBody>
  ) {
    this.logger.log({ message: "Chat Broadcast", chatId: message.id });
    this.roomGateway.broadcastChat(roomId, {
      rid: roomId,
      messages: [message],
    });
  }
}
// interface ChatResponse {
//   rid: string;
//   messages: Message<ChatBody | SystemBody>[];
// }
