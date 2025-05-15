import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTimeEntity } from '../../../common/entities/baseTime.entity';

@Entity('exercise_groups')
export class ExerciseGroup extends BaseTimeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  label: string;
}
