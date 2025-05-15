import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ExerciseGroup } from './exercise-group.entity';
import { BaseTimeEntity } from '../../../common/entities/baseTime.entity';

@Entity('exercise_categories')
export class ExerciseCategory extends BaseTimeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name: string;

  @ManyToOne(() => ExerciseGroup, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'groupId' })
  group: ExerciseGroup;

  @Column({ nullable: true })
  groupId: number;
}
