import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn, // THIS IS THE KEY CHANGE: Ensures UUID is automatically generated
  IsNull, // Import IsNull for checking null values in queries
  MoreThan, // Import MoreThan for checking dates greater than a value
} from "typeorm";
import { User } from "./User";

@Entity("refresh_tokens")
export class RefreshToken {
  // This is the primary key for the RefreshToken itself.
  // Using PrimaryGeneratedColumn("uuid") tells TypeORM to automatically generate a UUID for this column.
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  token!: string;

  // Defines the ManyToOne relationship: many refresh tokens can belong to one user.
  // The onDelete: "CASCADE" ensures that if a user is deleted, their refresh tokens are also deleted.
  // @JoinColumn specifies the foreign key column on *this* (RefreshToken) entity that links to the User entity.
  // It should point to `userId` on the RefreshToken, which then references the `id` on the User.
  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId", referencedColumnName: "id" })
  user!: User;

  // This column explicitly stores the UUID of the associated user.
  // It acts as the foreign key and is useful for direct queries without loading the full User object.
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  // The expiration date of the refresh token.
  @Column({ type: "timestamp with time zone", name: "expires_at" })
  expiresAt!: Date;

  // The date and time when this refresh token was issued.
  @CreateDateColumn({ name: "issued_at" })
  issuedAt!: Date;

  // Optional: To mark a token as revoked without immediately deleting it.
  // Useful for blacklisting tokens.
  @Column({
    type: "timestamp with time zone",
    nullable: true,
    name: "revoked_at",
  })
  revokedAt?: Date;

  // Optional: Stores the IP address from which the token was issued/used.
  // Good for security auditing.
  @Column({ nullable: true, name: "ip_address" })
  ipAddress?: string;

  // Optional: Stores the User-Agent string from the client.
  // Also useful for security auditing and tracking.
  @Column({ nullable: true, name: "user_agent" })
  userAgent?: string;
}
