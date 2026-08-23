CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorId` int,
	`title` varchar(255) NOT NULL,
	`slug` varchar(280) NOT NULL,
	`excerpt` text,
	`body` longtext,
	`topic` varchar(120) NOT NULL,
	`coverImageUrl` varchar(1000),
	`status` enum('draft','review','published') NOT NULL DEFAULT 'draft',
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `articles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`shortDescription` varchar(255),
	`iconKey` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`country` varchar(120) NOT NULL,
	`introduction` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cities_id` PRIMARY KEY(`id`),
	CONSTRAINT `cities_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `contactConsents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inquiryId` int NOT NULL,
	`channel` enum('email','sms') NOT NULL,
	`topic` varchar(160) NOT NULL,
	`consentSource` varchar(255) NOT NULL,
	`consentedAt` timestamp NOT NULL,
	`withdrawnAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contactConsents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int,
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(40),
	`message` longtext NOT NULL,
	`consentEmail` boolean NOT NULL DEFAULT false,
	`consentSms` boolean NOT NULL DEFAULT false,
	`status` enum('new','in_progress','closed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inquiries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int,
	`cityId` int NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`descriptor` varchar(255),
	`description` longtext,
	`neighbourhood` varchar(120),
	`address` varchar(255),
	`bookingUrl` varchar(1000),
	`contactEmail` varchar(320),
	`imageUrl` varchar(1000),
	`status` enum('draft','review','published') NOT NULL DEFAULT 'draft',
	`isFeatured` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `listings_id` PRIMARY KEY(`id`),
	CONSTRAINT `listings_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `messageTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channel` enum('email','sms') NOT NULL,
	`title` varchar(180) NOT NULL,
	`subject` varchar(255),
	`body` longtext NOT NULL,
	`purpose` varchar(180) NOT NULL,
	`status` enum('draft','approved','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `messageTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outboxMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`inquiryId` int NOT NULL,
	`channel` enum('email','sms') NOT NULL,
	`renderedContent` longtext NOT NULL,
	`status` enum('draft','ready_for_provider','sent','skipped') NOT NULL DEFAULT 'draft',
	`approvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	CONSTRAINT `outboxMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `practitioners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`role` varchar(160),
	`credentials` text,
	`biography` longtext,
	`imageUrl` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `practitioners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `premiumSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`placementEligible` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `premiumSubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `premium_listing_unique` UNIQUE(`listingId`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`durationMinutes` int,
	`priceFromCents` int,
	`description` text,
	`isBookable` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
