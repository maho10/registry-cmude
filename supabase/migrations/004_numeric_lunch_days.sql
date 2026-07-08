-- Switch from CMUDE-specific phase names back to generic day numbers
-- (arrival = day 1), so the schema generalizes to other events. Only days
-- that actually have lunch get a column — day 1 (arrival), day 6 (rest),
-- and day 9 (departure) never have lunch, so they're omitted.
ALTER TABLE participants RENAME COLUMN lunch_round0 TO lunch_day_2;
ALTER TABLE participants RENAME COLUMN lunch_round0_at TO lunch_day_2_at;
ALTER TABLE participants RENAME COLUMN lunch_r1_3 TO lunch_day_3;
ALTER TABLE participants RENAME COLUMN lunch_r1_3_at TO lunch_day_3_at;
ALTER TABLE participants RENAME COLUMN lunch_r4_6 TO lunch_day_4;
ALTER TABLE participants RENAME COLUMN lunch_r4_6_at TO lunch_day_4_at;
ALTER TABLE participants RENAME COLUMN lunch_r7_9 TO lunch_day_5;
ALTER TABLE participants RENAME COLUMN lunch_r7_9_at TO lunch_day_5_at;
ALTER TABLE participants RENAME COLUMN lunch_fourths TO lunch_day_7;
ALTER TABLE participants RENAME COLUMN lunch_fourths_at TO lunch_day_7_at;
ALTER TABLE participants RENAME COLUMN lunch_semis_finals TO lunch_day_8;
ALTER TABLE participants RENAME COLUMN lunch_semis_finals_at TO lunch_day_8_at;
