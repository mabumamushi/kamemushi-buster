ALTER TABLE `words` ADD COLUMN `level` integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
ALTER TABLE `runs` ADD COLUMN `level` integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
ALTER TABLE `scores` ADD COLUMN `level` integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
CREATE INDEX `words_level_idx` ON `words` (`level`,`id`);
--> statement-breakpoint
CREATE INDEX `scores_level_rank_idx` ON `scores` (`level`,`kills`,`created_at`);
