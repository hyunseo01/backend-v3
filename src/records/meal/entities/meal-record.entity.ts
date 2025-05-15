import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MealType } from './meal-type.entity';
import { BaseTimeEntity } from '../../../common/entities/baseTime.entity';
import { Account } from '../../../account/entities/account.entity';

@Entity('meal_records')
export class MealRecord extends BaseTimeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @Column()
  accountId: number;

  @ManyToOne(() => MealType, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'mealTypeId' })
  mealType: MealType;

  @Column({ nullable: true })
  mealTypeId: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'text', nullable: true })
  memo?: string;

  @Column({ nullable: true })
  calories?: number;
}
