import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseTimeEntity } from '../../../common/entities/baseTime.entity';

@Entity('meal_types')
export class MealType extends BaseTimeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 30, unique: true })
  label: string;
}
