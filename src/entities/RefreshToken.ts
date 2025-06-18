import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { User } from "./User";

@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryColumn("uuid")
  id!: string;
  @Column({ unique: true })
  token!: string;
  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
  @Column({ name: "user_id", type: "uuid" }) // Store the user's UUID
  userId!: string; // This property is useful for direct access without loading the full User object
  @Column({ type: "timestamp with time zone", name: "expires_at" })
  expiresAt!: Date;
  @CreateDateColumn({ name: "issued_at" }) // When this refresh token was created
  issuedAt!: Date;

  @Column({
    type: "timestamp with time zone",
    nullable: true,
    name: "revoked_at",
  })
  revokedAt?: Date; // To mark a token as revoked without deleting it immediately

  @Column({ nullable: true, name: "ip_address" })
  ipAddress?: string;

  @Column({ nullable: true, name: "user_agent" })
  userAgent?: string;
}
