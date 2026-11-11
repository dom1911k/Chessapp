// The full curriculum's lessons, stage by stage.
import type { Lesson } from '../data';
import { S1 } from './s1';
import { S2 } from './s2';
import { S3 } from './s3';
import { S4 } from './s4';

export const CURRICULUM_LESSONS: Lesson[] = [...S1, ...S2, ...S3, ...S4];
