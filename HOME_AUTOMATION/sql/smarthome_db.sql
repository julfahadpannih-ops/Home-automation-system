-- phpMyAdmin SQL Dump
-- version 5.2.1
-- Host: 127.0.0.1
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- Database: `smarthome_db`

-- --------------------------------------------------------
-- Table structure for table `devices`
-- --------------------------------------------------------

CREATE TABLE `devices` (
  `id` int(11) NOT NULL,
  `pin` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `value` float NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seed data: V0-V6 = controllable devices, V7-V9 = sensor readings (read-only)
INSERT INTO `devices` (`id`, `pin`, `name`, `value`) VALUES
(1,  '0', 'Living Fan 1',   0),
(2,  '1', 'Bedroom Fan',    0),
(3,  '2', 'Living Light 1', 0),
(4,  '3', 'Kitchen Light',  0),
(5,  '4', 'Bed Light',      0),
(6,  '5', 'Living Light 2', 0),
(7,  '6', 'Guest Fan',      0),
(8,  '7', 'Temperature',    0),
(9,  '8', 'Humidity',       0),
(10, '9', 'LDR Value',      0);

-- --------------------------------------------------------
-- Table structure for table `device_history`
-- --------------------------------------------------------

CREATE TABLE `device_history` (
  `id` int(11) NOT NULL,
  `pin` varchar(10) NOT NULL,
  `value` float NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table structure for table `energy_log`
-- --------------------------------------------------------

CREATE TABLE `energy_log` (
  `id` int(11) NOT NULL,
  `watts_consumed` float NOT NULL,
  `timestamp` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table structure for table `users`
-- --------------------------------------------------------

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `users` (`id`, `username`, `password`) VALUES
(1, 'admin', '$2y$12$zyV5zIbbnbzP99nbRkQSfeuN4Lp7ctmoGE1U4fmc2/oWzztB6rEVm');

-- --------------------------------------------------------
-- Indexes
-- --------------------------------------------------------

ALTER TABLE `devices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `pin` (`pin`);

ALTER TABLE `device_history`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `energy_log`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

-- AUTO_INCREMENT

ALTER TABLE `devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

ALTER TABLE `device_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `energy_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
