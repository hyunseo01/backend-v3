import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ExerciseCategory } from './exercise-category.entity';
import { BaseTimeEntity } from '../../../common/entities/baseTime.entity';
import { Account } from '../../../account/entities/account.entity';

@Entity('exercise_records')
export class ExerciseRecord extends BaseTimeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @Column()
  accountId: number;

  @ManyToOne(() => ExerciseCategory, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category: ExerciseCategory;

  @Column({ nullable: true })
  categoryId: number;

  @Column()
  duration: number;

  @Column()
  intensity: number;

  @Column({ type: 'date' })
  date: Date;
}
