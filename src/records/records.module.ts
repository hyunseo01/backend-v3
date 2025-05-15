import { Module } from '@nestjs/common';
import { ExerciseModule } from './exercise/exercise.module';
import { MealModule } from './meal/meal.module';
import { RecordController } from './record.controller';

@Module({
  imports: [ExerciseModule, MealModule],
  controllers: [RecordController],
})
export class RecordsModule {}
