import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  ValueTransformer,
} from "typeorm";
import { Room } from "./Room";
import { SectionType } from "../user/interfaces/user";
import { CategoryType } from "../match/interfaces/category.interface";

export const bigint: ValueTransformer = {
  to: (entityValue: number) => entityValue,
  from: (databaseValue: string): number => parseInt(databaseValue, 10),
};

@Entity("match_entity")
export class Match {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    nullable: false,
  })
  shopName: string;

  @Column({
    nullable: false,
  })
  purchaserName: string;

  @Column({
    nullable: false,
  })
  category: CategoryType;

  @Column({
    nullable: false,
  })
  section: SectionType;

  @Column({
    nullable: false,
  })
  atLeastPrice: number;

  @Column({
    nullable: false,
  })
  totalPrice: number;

  @Column({
    nullable: false,
    type: "bigint",
    default: Date.now(),
    transformer: [bigint],
  })
  createdAt: number;

  @Column({ nullable: true })
  roomId: string;

  @ManyToOne(() => Room, { onDelete: "SET NULL" })
  room: Room;

  static create(room: Room): Match {
    return new Match().update(room);
  }

  update(room: Room): Match {
    this.shopName = room.shopName;
    this.purchaserName = room.purchaser.name;
    this.category = room.category;
    this.section = room.section;
    this.atLeastPrice = room.atLeastPrice;
    this.totalPrice = room.getTotalPrice();
    this.room = room;
    return this;
  }
}
