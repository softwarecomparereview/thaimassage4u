CREATE TABLE `cityEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cityId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`category` varchar(120),
	`venue` varchar(180),
	`description` text,
	`sourceName` varchar(180) NOT NULL,
	`sourceUrl` varchar(1000) NOT NULL,
	`sourceCheckedAt` timestamp NOT NULL,
	`status` enum('draft','verified','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cityEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cityMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cityId` int NOT NULL,
	`metricKey` varchar(120) NOT NULL,
	`label` varchar(180) NOT NULL,
	`value` varchar(120) NOT NULL,
	`methodology` text NOT NULL,
	`sourceName` varchar(180) NOT NULL,
	`sourceUrl` varchar(1000) NOT NULL,
	`observedAt` timestamp NOT NULL,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cityMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `localizedContent` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('city','listing','article','category') NOT NULL,
	`entityId` int NOT NULL,
	`locale` varchar(16) NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(280),
	`excerpt` text,
	`body` longtext,
	`status` enum('draft','native_review','published') NOT NULL DEFAULT 'draft',
	`reviewedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `localizedContent_id` PRIMARY KEY(`id`),
	CONSTRAINT `localized_content_entity_locale_unique` UNIQUE(`entityType`,`entityId`,`locale`)
);
--> statement-breakpoint
ALTER TABLE `cities` ADD `countryCode` varchar(2) DEFAULT 'TH' NOT NULL;--> statement-breakpoint
ALTER TABLE `cities` ADD `primaryLocale` varchar(16) DEFAULT 'en' NOT NULL;