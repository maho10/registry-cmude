-- Replace generic lunch_day_1..6 with named CMUDE phases, and rename
-- event_config.start_date to arrival_date to reflect that it's the arrival
-- day, not "day 1" (round 0 is day 1, offset by the rest day gap).
ALTER TABLE participants RENAME COLUMN lunch_day_1 TO lunch_round0;
ALTER TABLE participants RENAME COLUMN lunch_day_1_at TO lunch_round0_at;
ALTER TABLE participants RENAME COLUMN lunch_day_2 TO lunch_r1_3;
ALTER TABLE participants RENAME COLUMN lunch_day_2_at TO lunch_r1_3_at;
ALTER TABLE participants RENAME COLUMN lunch_day_3 TO lunch_r4_6;
ALTER TABLE participants RENAME COLUMN lunch_day_3_at TO lunch_r4_6_at;
ALTER TABLE participants RENAME COLUMN lunch_day_4 TO lunch_r7_9;
ALTER TABLE participants RENAME COLUMN lunch_day_4_at TO lunch_r7_9_at;
ALTER TABLE participants RENAME COLUMN lunch_day_5 TO lunch_fourths;
ALTER TABLE participants RENAME COLUMN lunch_day_5_at TO lunch_fourths_at;
ALTER TABLE participants RENAME COLUMN lunch_day_6 TO lunch_semis_finals;
ALTER TABLE participants RENAME COLUMN lunch_day_6_at TO lunch_semis_finals_at;

ALTER TABLE event_config RENAME COLUMN start_date TO arrival_date;
