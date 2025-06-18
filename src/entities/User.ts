import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;
  @Column({ unique: true })
  email!: string;
  @Column({ name: "password_hash" })
  hashedPassword!: string;
  @Column({ nullable: true }) // Optional field
  firstName?: string;

  @Column({ nullable: true }) // Optional field
  lastName?: string;

  @Column({ default: false })
  isVerified!: boolean;

  @Column("text", { array: true, default: ["user"] }) // PostgreSQL array of text for roles
  roles!: string[];

  @CreateDateColumn({ name: "created_at" }) // Automatically sets creation timestamp
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" }) // Automatically updates timestamp on entity updates
  updatedAt!: Date;

  @Column({
    type: "timestamp with time zone",
    nullable: true,
    name: "last_login_at",
  })
  lastLoginAt?: Date;
}
