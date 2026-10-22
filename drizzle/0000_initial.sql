CREATE TABLE `words` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `english` text NOT NULL,
  `japanese` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
  `id` text PRIMARY KEY NOT NULL,
  `started_at` integer NOT NULL,
  `used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scores` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `kills` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scores_rank_idx` ON `scores` (`kills`,`created_at`);
