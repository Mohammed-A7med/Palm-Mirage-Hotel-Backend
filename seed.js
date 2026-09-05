import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

import { FacilityModel } from "./src/DB/Model/Facility.model.js";
import { RoomAmenityModel } from "./src/DB/Model/RoomAmenity.model.js";
import { TableModel } from "./src/DB/Model/table.model.js";
import { hotelModel } from "./src/DB/Model/Hotel.model.js";
import { restaurantPageModel } from "./src/DB/Model/RestaurantPage.model.js";
import { userModel } from "./src/DB/Model/User.model.js";
import { RoomModel } from "./src/DB/Model/Room.model.js";
import { menuModel } from "./src/DB/Model/Menu.model.js";
import { activityModel } from "./src/DB/Model/Activity.model.js";
import { activityScheduleModel } from "./src/DB/Model/ActivitySchedule.model.js";
import Booking from "./src/DB/Model/booking.model.js";
import RestaurantBooking from "./src/DB/Model/bookingTable.model.js";
import { UserBooking } from "./src/DB/Model/UserBooking.model.js";
import { activityBookingModel } from "./src/DB/Model/ActivityBooking.model.js";
import { PaymentCheckoutSession } from "./src/DB/Model/PaymentCheckoutSession.model.js";
import { NotificationModel } from "./src/DB/Model/Notification.model.js";
import { BookingAuditLog } from "./src/DB/Model/BookingAuditLog.model.js";
import Category from "./src/DB/Model/Category.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.join(__dirname, "seed-data");
const resetRequested = process.argv.includes("--reset");
const validateOnly = process.argv.includes("--validate");

const files = {
  categories: "categories.json",
  facilities: "facilities.json",
  amenities: "room-amenities.json",
  tables: "tables.json",
  hotels: "hotels.json",
  restaurantPages: "restaurant-pages.json",
  users: "users.json",
  rooms: "rooms.json",
  menus: "menus.json",
  activities: "activities.json",
  schedules: "activity-schedules.json",
  roomBookings: "bookings.room.json",
  restaurantBookings: "bookings.restaurant.json",
  userBookings: "user-bookings.json",
  activityBookings: "activity-bookings.json",
  paymentSessions: "payment-checkout-sessions.json",
  notifications: "notifications.json",
  auditLogs: "booking-audit-logs.json",
};

const load = (fileName) => JSON.parse(fs.readFileSync(path.join(seedDir, fileName), "utf8"));
const data = Object.fromEntries(Object.entries(files).map(([key, fileName]) => [key, load(fileName)]));

const roomImagePool = [
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/living-room-with-fireplace-wood-burning-stove.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/modern-cozy-bedroom-interior-with-three-panoramic-window-1.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/mountain-lifestyle-12-1.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/mountain-view-bedroom-with-large-windows-private-balcony-1.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/pexels-sylvia-p-269813275-16068765-1.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/photorealistic-timber-house-interior-with-wooden-decor-furnishings.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/photorealistic-wooden-house-interior-with-timber-decor-furnishings-1.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/photorealistic-wooden-house-interior-with-timber-decor-furnishings.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/dining-room-cozy-wooden-house-rural-style-room-with-table-chairs-cupboard-decoration.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/diverse-young-people-being-digital-nomads-working-remotely-from-dreamy-locations-1.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/house-cliff-with-view-mountains-river-1.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/bedroom-with-stunning-view-lake-mountains-offering-tranquil-luxurious-getaway.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/cozy-cabin-with-view-mountains-1.png",
  "https://sailing.thimpress.com/demo-mountain-hotel/wp-content/uploads/sites/27/2024/04/bedroom-with-large-window-overlooking-snowy-forest-1-1.png",
];

const randomRoomImages = () => [...roomImagePool]
  .sort(() => Math.random() - 0.5)
  .slice(0, 3)
  .map((secure_url, index) => ({ secure_url, public_id: `seed-room-image-${index + 1}` }));

const roomsWithUpdatedImages = data.rooms.map((room) => ({
  ...room,
  roomImages: randomRoomImages(),
}));

const expectedCounts = {
  categories: 4,
  facilities: 15,
  amenities: 15,
  tables: 15,
  hotels: 2,
  restaurantPages: 1,
  users: 25,
  rooms: 15,
  menus: 15,
  activities: 15,
  schedules: 15,
  roomBookings: 15,
  restaurantBookings: 15,
  userBookings: 15,
  activityBookings: 15,
  paymentSessions: 15,
  notifications: 15,
  auditLogs: 15,
};

function validateSeedData() {
  const errors = [];
  const ids = new Set();
  const sets = {};

  for (const [key, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) {
      errors.push(`${key} is not an array`);
      continue;
    }
    if (rows.length !== expectedCounts[key]) {
      errors.push(`${key} expected ${expectedCounts[key]} records, found ${rows.length}`);
    }
    sets[key] = new Set();
    for (const row of rows) {
      if (!/^[0-9a-f]{24}$/.test(row._id || "")) {
        errors.push(`${key} has an invalid ObjectId: ${row._id}`);
      }
      if (ids.has(row._id)) {
        errors.push(`duplicate ObjectId: ${row._id}`);
      }
      ids.add(row._id);
      sets[key].add(row._id);
    }
  }

  const refs = [
    ["rooms", "facilities", "facilities"],
    ["rooms", "amenities", "amenities"],
    ["menus", "createdBy", "users"],
    ["activities", "createdBy", "users"],
    ["schedules", "activity", "activities"],
    ["schedules", "createdBy", "users"],
    ["roomBookings", "user", "users"],
    ["roomBookings", "room", "rooms"],
    ["restaurantBookings", "user", "users"],
    ["userBookings", "user", "users"],
    ["userBookings", "room", "rooms"],
    ["activityBookings", "user", "users"],
    ["activityBookings", "activity", "activities"],
    ["activityBookings", "schedule", "schedules"],
    ["paymentSessions", "user", "users"],
    ["paymentSessions", "linkedActivityBookings", "activityBookings"],
    ["paymentSessions", "linkedRestaurantBookings", "restaurantBookings"],
    ["auditLogs", "actorId", "users"],
  ];

  for (const [source, field, target] of refs) {
    for (const row of data[source]) {
      const values = Array.isArray(row[field]) ? row[field] : [row[field]];
      for (const value of values.filter(Boolean)) {
        if (!sets[target]?.has(value)) {
          errors.push(`${source}.${field} references missing ${target} id ${value}`);
        }
      }
    }
  }

  const menuCategories = new Set(data.categories.map((category) => category.label));
  for (const menu of data.menus) {
    if (!menuCategories.has(menu.category)) errors.push(`menu category does not exist: ${menu.category}`);
  }

  for (const booking of data.restaurantBookings) {
    for (const item of booking.lineItems || []) {
      if (!sets.menus.has(item.menuItem)) errors.push(`restaurant line item references missing menu ${item.menuItem}`);
    }
  }

  for (const session of data.paymentSessions) {
    for (const item of session.items || []) {
      if (!sets.rooms.has(item.room)) errors.push(`checkout item references missing room ${item.room}`);
    }
  }

  const bookingIds = new Set([...sets.roomBookings, ...sets.restaurantBookings, ...sets.activityBookings]);
  for (const notification of data.notifications) {
    for (const bookingId of notification.bookingIds || []) {
      if (!bookingIds.has(bookingId)) errors.push(`notification references missing booking ${bookingId}`);
    }
  }

  const auditTargets = new Set([
    ...sets.roomBookings,
    ...sets.restaurantBookings,
    ...sets.activityBookings,
    ...sets.paymentSessions,
  ]);
  for (const audit of data.auditLogs) {
    if (!auditTargets.has(audit.entityId)) errors.push(`audit log references missing entity ${audit.entityId}`);
  }

  if (errors.length) throw new Error(`Seed preflight validation failed:\n${errors.join("\n")}`);
  console.log(`Preflight passed: ${Object.keys(files).length} files and ${ids.size} unique ObjectIds.`);
}

function hashUsers() {
  const saltRounds = parseInt(process.env.SALT, 10);
  if (!Number.isInteger(saltRounds) || saltRounds <= 0) {
    throw new Error("SALT must be a positive integer in src/config/.env.dev");
  }

  return data.users.map(({ seedPassword, ...user }) => ({
    ...user,
    password: bcrypt.hashSync(seedPassword, saltRounds),
  }));
}

async function insertAndLog(label, model, rows) {
  const inserted = await model.insertMany(rows, { ordered: true });
  console.log(`Inserted ${inserted.length} ${label}`);
}

async function resetCollections() {
  const collectionNames = [
    "categories",
    "facilities",
    "roomamenities",
    "tables",
    "hotels",
    "restaurantpages",
    "users",
    "rooms",
    "menus",
    "activities",
    "activityschedules",
    "bookings",
    "userbookings",
    "activitybookings",
    "paymentcheckoutsessions",
    "notifications",
    "bookingauditlogs",
  ];

  for (const collectionName of collectionNames) {
    await mongoose.connection.db.collection(collectionName).deleteMany({});
  }
  console.log(`Reset ${collectionNames.length} target collections.`);
}

async function seed() {
  dotenv.config({ path: path.resolve(__dirname, "src/config/.env.dev") });
  validateSeedData();
  if (validateOnly) {
    console.log("Seed validation completed successfully.");
    return;
  }

  if (!process.env.DB_URL) throw new Error("DB_URL is missing in src/config/.env.dev");

  const rawDbUrl = process.env.DB_URL.trim();
  const dbUrl = rawDbUrl.startsWith("mongodb://") || rawDbUrl.startsWith("mongodb+srv://")
    ? rawDbUrl
    : `mongodb://${rawDbUrl}`;

  await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB.");

  try {
    if (resetRequested) await resetCollections();

    await insertAndLog("categories", Category, data.categories);
    await insertAndLog("facilities", FacilityModel, data.facilities);
    await insertAndLog("room amenities", RoomAmenityModel, data.amenities);
    await insertAndLog("tables", TableModel, data.tables);
    await insertAndLog("hotels", hotelModel, data.hotels);
    await insertAndLog("restaurant pages", restaurantPageModel, data.restaurantPages);
    await insertAndLog("users", userModel, hashUsers());
    await insertAndLog("rooms", RoomModel, roomsWithUpdatedImages);
    await insertAndLog("menu items", menuModel, data.menus);
    await insertAndLog("activities", activityModel, data.activities);
    await insertAndLog("activity schedules", activityScheduleModel, data.schedules);

    const bookingsCollection = mongoose.connection.collection("bookings");
    const roomBookings = await bookingsCollection.insertMany(data.roomBookings, { ordered: true });
    console.log(`Inserted ${roomBookings.insertedCount} room bookings into bookings collection`);
    const restaurantBookings = await bookingsCollection.insertMany(data.restaurantBookings, { ordered: true });
    console.log(`Inserted ${restaurantBookings.insertedCount} restaurant bookings into bookings collection`);

    await insertAndLog("user bookings", UserBooking, data.userBookings);
    await insertAndLog("activity bookings", activityBookingModel, data.activityBookings);
    await insertAndLog("payment checkout sessions", PaymentCheckoutSession, data.paymentSessions);
    await insertAndLog("notifications", NotificationModel, data.notifications);
    await insertAndLog("booking audit logs", BookingAuditLog, data.auditLogs);

    console.log("Seed completed successfully.");
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed.");
  }
}

seed().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  if (mongoose.connection.readyState !== 0) {
    mongoose.disconnect().catch(() => {});
  }
  process.exitCode = 1;
});
