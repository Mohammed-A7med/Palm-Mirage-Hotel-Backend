/**
 * Full local dataset (users, 100 rooms, room amenities, menu, restaurant page images, activities, …).
 * Run from Backend: `node scripts/seed-local-data.js` (requires DB_URL in src/config/.env.dev).
 * Menu-only refresh (keeps tables & table bookings): `node scripts/seed-local-data.js --menu-only`
 * Also backfills `paymentStatus` on restaurant bookings missing it (unpaid).
 * Full seed does not wipe Table / bookings collections — re-runs upsert tables and skip duplicate bookings.
 */
import path from "node:path";
import * as dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve("./src/config/.env.dev") });

import { userModel, roleTypes, providerTypes, genderTypes } from "../src/DB/Model/User.model.js";
import { FacilityModel } from "../src/DB/Model/Facility.model.js";
import { RoomModel } from "../src/DB/Model/Room.model.js";
import { RoomAmenityModel } from "../src/DB/Model/RoomAmenity.model.js";
import { UserBooking } from "../src/DB/Model/UserBooking.model.js";
import { TableModel } from "../src/DB/Model/table.model.js";
import TableBookingModel from "../src/DB/Model/bookingTable.model.js";
import Category from "../src/DB/Model/Category.model.js";
import { menuModel } from "../src/DB/Model/Menu.model.js";
import { restaurantPageModel } from "../src/DB/Model/RestaurantPage.model.js";
import { activityModel } from "../src/DB/Model/Activity.model.js";
import { activityScheduleModel } from "../src/DB/Model/ActivitySchedule.model.js";
import { activityBookingModel } from "../src/DB/Model/ActivityBooking.model.js";
import { hotelModel } from "../src/DB/Model/Hotel.model.js";

const rawDbUrl = process.env.DB_URL?.trim();
const dbUrl =
  rawDbUrl?.startsWith("mongodb://") || rawDbUrl?.startsWith("mongodb+srv://")
    ? rawDbUrl
    : rawDbUrl
      ? `mongodb://${rawDbUrl}`
      : "";

const now = new Date();
const dayMs = 24 * 60 * 60 * 1000;
const hourMs = 60 * 60 * 1000;
const u = (id, w = 1600, h = 1000) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
/** Pexels — reliable CDN for menu item thumbnails */
const px = (path) =>
  `https://images.pexels.com/photos/${path}?auto=compress&cs=tinysrgb&w=900&h=720&fit=crop`;
/** Pexels — wide hero / category images */
const pc = (path, w = 1600, h = 1000) =>
  `https://images.pexels.com/photos/${path}?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;
const face = (type, id) => `https://randomuser.me/api/portraits/${type}/${id}.jpg`;
const addDays = (days, hour = 12, minute = 0) => {
  const date = new Date(now.getTime() + days * dayMs);
  date.setHours(hour, minute, 0, 0);
  return date;
};
const addHours = (date, hours) => new Date(date.getTime() + hours * hourMs);
const time = (hour, minute = 0) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

/** Room gallery pool; each seeded room receives three distinct random images. */
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
  .slice(0, 3);

const ROOM_TYPE_ORDER = ["single", "double", "twin", "deluxe", "family"];
const ROOM_WINGS = ["Nile", "East", "West", "Garden", "Royal", "Palm", "Sky", "Courtyard"];
const TYPE_LABEL = { single: "Single", double: "Double", twin: "Twin", deluxe: "Deluxe", family: "Family" };
const BASE_PRICE = { single: 1950, double: 3050, twin: 2880, deluxe: 4550, family: 6400 };

async function seedRoomAmenities() {
  const defs = [
    { name: "High-Speed Wi-Fi", icon: "Wifi", description: "Fast wireless internet in the room." },
    { name: "Air Conditioning", icon: "Wind", description: "Individually controlled climate." },
    { name: "Smart TV", icon: "Tv", description: "Flat-screen smart TV with streaming." },
    { name: "Mini Bar", icon: "Refrigerator", description: "Minibar with drinks and snacks." },
    { name: "Coffee Station", icon: "Coffee", description: "Tea and coffee making facilities." },
    { name: "Private Bathroom", icon: "Bath", description: "En-suite bathroom with amenities." },
    { name: "Electronic Safe", icon: "Lock", description: "In-room safe for valuables." },
    { name: "Direct Dial Phone", icon: "Phone", description: "Direct line to reception." },
    { name: "Work Desk", icon: "Monitor", description: "Desk suited for remote work." },
    { name: "Balcony", icon: "Umbrella", description: "Private balcony or terrace seating." },
    { name: "Daily Housekeeping", icon: "Shirt", description: "Daily housekeeping service." },
    { name: "Rain Shower", icon: "Droplets", description: "Walk-in rain shower." },
  ];
  return RoomAmenityModel.create(defs);
}

const categoryImages = {
  Appetizer: pc("1640772/pexels-photo-1640772.jpeg"),
  Restaurant: pc("262978/pexels-photo-262978.jpeg"),
  Desserts: pc("45202/brownie-dessert-cake-sweet-45202.jpeg"),
  Drinks: pc("1283219/pexels-photo-1283219.jpeg"),
};

const activityImages = {
  balloon: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Balloon%20over%20Luxor%20-%20Egypt%20denoised.jpg",
  nile: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Nile%20Feluccas%20in%20Aswan.jpg",
  heritage: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Luxor%2C%20Egypt%2C%20Karnak.jpg",
  desert: "https://commons.wikimedia.org/wiki/Special:Redirect/file/DESERT%20SAFARI.jpg",
  cultural: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&h=1000&q=80",
  culinary: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Egyptian%20food%20Koshary.jpg",
};

async function resetCollections() {
  await Promise.all([
    activityBookingModel.deleteMany({}),
    activityScheduleModel.deleteMany({}),
    activityModel.deleteMany({}),
    menuModel.deleteMany({}),
    restaurantPageModel.deleteMany({}),
    Category.deleteMany({}),
    UserBooking.deleteMany({}),
    RoomModel.deleteMany({}),
    RoomAmenityModel.deleteMany({}),
    FacilityModel.deleteMany({}),
    hotelModel.deleteMany({}),
    userModel.deleteMany({}),
  ]);
}

async function seedUsers() {
  const defs = [
    ["Admin Local", "Egypt", "admin.local@palmhotel.com", "Admin123!", genderTypes.male, roleTypes.admin, "+201001110000", face("men", 12)],
    ["Omar Tarek", "Egypt", "cr7omartarek@gmail.com", "moAhmed123", genderTypes.male, roleTypes.user, "+201001110099", face("men", 32)],
    ["Nour Hassan", "Egypt", "nour.hassan@example.com", "User123!", genderTypes.female, roleTypes.user, "+201001110001", face("women", 21)],
    ["Omar Adel", "Egypt", "omar.adel@example.com", "User123!", genderTypes.male, roleTypes.user, "+201001110002", face("men", 22)],
    ["Mona Ali", "Egypt", "mona.ali@example.com", "User123!", genderTypes.female, roleTypes.user, "+201001110003", face("women", 23)],
    ["Youssef Nabil", "Egypt", "youssef.nabil@example.com", "User123!", genderTypes.male, roleTypes.user, "+201001110004", face("men", 24)],
    ["Salma Wael", "Egypt", "salma.wael@example.com", "User123!", genderTypes.female, roleTypes.user, "+201001110005", face("women", 25)],
    ["Karim Fathy", "Egypt", "karim.fathy@example.com", "User123!", genderTypes.male, roleTypes.user, "+201001110006", face("men", 26)],
    ["Farah Samir", "Egypt", "farah.samir@example.com", "User123!", genderTypes.female, roleTypes.user, "+201001110007", face("women", 26)],
    ["Ahmed Tarek", "Egypt", "ahmed.tarek@example.com", "User123!", genderTypes.male, roleTypes.user, "+201001110008", face("men", 27)],
    ["Aya Mostafa", "Egypt", "aya.mostafa@example.com", "User123!", genderTypes.female, roleTypes.user, "+201001110009", face("women", 27)],
    ["Layla Hussein", "UAE", "layla.hussein@example.com", "User123!", genderTypes.female, roleTypes.user, "+971501230001", face("women", 28)],
    ["Samir Khaled", "Jordan", "samir.khaled@example.com", "User123!", genderTypes.male, roleTypes.user, "+962790000001", face("men", 28)],
    ["Rana Ibrahim", "Saudi Arabia", "rana.ibrahim@example.com", "User123!", genderTypes.female, roleTypes.user, "+966551230001", face("women", 29)],
    ["Tamer Hany", "Egypt", "tamer.hany@example.com", "User123!", genderTypes.male, roleTypes.user, "+201001110010", face("men", 29)],
    ["Hana Magdy", "Egypt", "hana.magdy@example.com", "User123!", genderTypes.female, roleTypes.user, "+201001110011", face("women", 30)],
    ["Mostafa Ashraf", "Egypt", "mostafa.ashraf@example.com", "User123!", genderTypes.male, roleTypes.user, "+201001110012", face("men", 30)],
  ];
  return userModel.create(
    defs.map(([userName, country, email, password, gender, role, phoneNumber, image], index) => ({
      userName, country, email, password, gender, role, phoneNumber, image,
      provider: providerTypes.system,
      isConfirmed: true,
      DOB: new Date(1989 + (index % 9), index % 12, 5 + (index % 20)),
    }))
  );
}

async function seedFacilities() {
  return FacilityModel.create([
    { name: "Infinity Pool", category: "Leisure", description: "Rooftop Nile-view pool.", location: "Roof Deck", capacity: 60, status: "Available", image: u("photo-1578683010236-d716f9a3f461"), icon: "Waves", operatingHours: "08:00 - 22:00" },
    { name: "Desert Bloom Spa", category: "Wellness", description: "Spa suites and massage rooms.", location: "Level 1", capacity: 18, status: "Available", image: u("photo-1519823551278-64ac92734fb1"), icon: "Sparkles", operatingHours: "10:00 - 23:00" },
    { name: "Palm Fit Gym", category: "Fitness", description: "Cardio and weights studio.", location: "Level 1", capacity: 25, status: "Available", image: u("photo-1534438327276-14e5300c3a48"), icon: "Dumbbell", operatingHours: "06:00 - 00:00" },
    { name: "Mirage Restaurant", category: "Dining", description: "Main all-day dining room.", location: "Ground Floor", capacity: 120, status: "Available", image: u("photo-1552566626-52f8b828add9"), icon: "UtensilsCrossed", operatingHours: "07:00 - 00:00" },
    { name: "Skyline Lounge", category: "Leisure", description: "Rooftop evening lounge.", location: "Roof Deck", capacity: 80, status: "Busy", image: u("photo-1506744038136-46273834b3fb"), icon: "MoonStar", operatingHours: "16:00 - 01:00" },
    { name: "Business Hub", category: "Business", description: "Meeting pods and printers.", location: "Mezzanine", capacity: 30, status: "Available", image: u("photo-1497366754035-f200968a6e72"), icon: "BriefcaseBusiness", operatingHours: "08:00 - 20:00" },
    { name: "Kids Corner", category: "Family", description: "Indoor play area.", location: "Ground Floor", capacity: 20, status: "Available", image: u("photo-1516627145497-ae6968895b74"), icon: "ToyBrick", operatingHours: "10:00 - 21:00" },
    { name: "Airport Shuttle", category: "Transport", description: "Scheduled airport transfer.", location: "Main Entrance", capacity: 14, status: "Available", image: u("photo-1503376780353-7e6692767b70"), icon: "Bus", operatingHours: "24/7 on request" },
    { name: "Private Beach Access", category: "Leisure", description: "Partner beach day access.", location: "Beach Club", capacity: 50, status: "Closed", image: u("photo-1507525428034-b723cf961d3e"), icon: "Sun", operatingHours: "09:00 - 18:00" },
    { name: "Laundry Express", category: "Service", description: "Same-day pressing and laundry.", location: "Service Basement", capacity: 200, status: "Available", image: u("photo-1517677208171-0bc6725a3e60"), icon: "Shirt", operatingHours: "08:00 - 22:00" },
  ]);
}

async function seedHotel() {
  return hotelModel.create({ name: "Palm Mirage Hotel", Location: "Luxor, Egypt", Gid: 1 });
}

function capacityForRoomType(roomType, index) {
  if (roomType === "single") return 1;
  if (roomType === "double" || roomType === "twin") return 2;
  if (roomType === "deluxe") return 2 + (index % 2);
  return 4 + (index % 3);
}

/** 100 rooms (101–200): every type, multiple floors, offers, discounts, and image variety for QA */
async function seedRooms(facilities, roomAmenities) {
  const facilityIds = facilities.map((f) => f._id);
  const amenityIds = roomAmenities.map((a) => a._id);
  const totalRooms = 100;
  const startNumber = 101;

  const docs = Array.from({ length: totalRooms }, (_, i) => {
    const roomNumber = startNumber + i;
    const floor = Math.floor(i / 10) + 1;
    const roomType = ROOM_TYPE_ORDER[i % ROOM_TYPE_ORDER.length];
    const wing = ROOM_WINGS[i % ROOM_WINGS.length];
    const label = TYPE_LABEL[roomType];
    const roomName = `${wing} ${label} · ${roomNumber}`;

    const base = BASE_PRICE[roomType];
    const price = base + floor * 85 + (i % 7) * 110 + (i % 3) * 55;
    const discount = [0, 0, 5, 8, 10, 12, 15][i % 7];
    const capacity = capacityForRoomType(roomType, i);
    const rating = Math.min(5, Math.round((3.5 + (i % 15) * 0.1 + (i % 4) * 0.05) * 10) / 10);
    const reviewsCount = 8 + (i * 11) % 220;
    const viewsCount = 120 + (i * 37) % 4200;
    const hasOffer = i % 3 === 0;
    const isAvailable = i % 9 !== 0;
    const checkInTime = i % 8 === 0 ? "15:00" : "14:00";
    const checkOutTime = i % 11 === 0 ? "11:00" : "12:00";

    const [imgA, imgB, imgC] = randomRoomImages();

    const fi = i % Math.max(1, facilityIds.length - 4);
    const ai = i % Math.max(1, amenityIds.length - 3);

    const descriptions = [
      `Quiet ${label.toLowerCase()} room on floor ${floor} with Nile-inspired tones and blackout curtains.`,
      `${label} layout ideal for ${capacity}-guest comfort; warm lighting and premium bedding.`,
      `Spacious ${label.toLowerCase()} with thoughtful workspace, refreshed daily for extended stays.`,
      `Corner ${label.toLowerCase()} with extra natural light; family-friendly touches where applicable.`,
    ];

    return {
      roomName,
      roomNumber,
      roomType,
      price,
      capacity,
      discount,
      floor,
      rating,
      reviewsCount,
      viewsCount,
      hasOffer,
      description: descriptions[i % descriptions.length],
      facilities: facilityIds.slice(fi, fi + 5),
      amenities: amenityIds.slice(ai, ai + 5),
      roomImages: [
        { secure_url: imgA, public_id: `seed-room-${roomNumber}-a` },
        { secure_url: imgB, public_id: `seed-room-${roomNumber}-b` },
        { secure_url: imgC, public_id: `seed-room-${roomNumber}-c` },
      ],
      isAvailable,
      checkInTime,
      checkOutTime,
      cancellationPolicy:
        i % 4 === 0
          ? "Free cancellation up to 48 hours before arrival."
          : i % 4 === 1
            ? "Non-refundable after confirmation."
            : i % 4 === 2
              ? "Free cancellation until 72 hours prior; 50% charge after."
              : "Flexible rebooking to another date within 12 months.",
    };
  });

  return RoomModel.create(docs);
}

async function seedRoomBookings(users, rooms) {
  const roomCount = rooms.length;
  const maxUserIdx = Math.max(1, users.length - 1);
  const notes = [
    "High floor and extra pillows",
    "Baby crib and quiet room",
    "Early breakfast box",
    "Late arrival after midnight",
    "Anniversary setup",
    "Airport pickup requested",
    "Flight changed — cancelled",
    "Near elevator preferred",
    "Family room with crib",
    "Non-smoking room",
    "Extra towels",
    "River view if possible",
    "Connecting rooms request",
    "Late checkout interest",
    "Ground floor for mobility",
    "Twin beds confirmed",
    "Allergen-free pillows",
    "Corporate billing reference",
    "Honeymoon decoration",
    "Two keys required",
  ];

  const defs = Array.from({ length: 48 }, (_, b) => {
    const userIndex = 1 + (b % maxUserIdx);
    const roomIndex = (b * 19 + (b % 7) * 3) % roomCount;
    const startOffset = -14 + (b % 22);
    const endOffset = startOffset + 2 + (b % 6);
    const guests = 1 + (b % 5);
    const statusCycle = ["confirmed", "pending", "completed", "cancelled", "confirmed", "confirmed"];
    const status = statusCycle[b % statusCycle.length];
    let paymentStatus = "paid";
    let paymentMethod = b % 2 === 0 ? "card" : "online";
    if (status === "pending") {
      paymentStatus = "unpaid";
      paymentMethod = "online";
    } else if (status === "cancelled") {
      paymentStatus = "refunded";
      paymentMethod = "online";
    } else if (b % 9 === 0) {
      paymentMethod = "cash";
    }
    return {
      userIndex,
      roomIndex,
      startOffset,
      endOffset,
      guests,
      status,
      paymentStatus,
      paymentMethod,
      specialRequests: notes[b % notes.length],
    };
  });

  return UserBooking.create(
    defs.map(
      ({
        userIndex,
        roomIndex,
        startOffset,
        endOffset,
        guests,
        status,
        paymentStatus,
        paymentMethod,
        specialRequests,
      }) => {
        const room = rooms[roomIndex];
        const checkInDate = addDays(startOffset, 14);
        const checkOutDate = addDays(endOffset, 12);
        const nights = Math.max(1, Math.ceil((checkOutDate - checkInDate) / dayMs));
        return {
          user: users[userIndex]._id,
          room: room._id,
          checkInDate,
          checkOutDate,
          totalPrice: Math.round((room.finalPrice || room.price) * nights),
          guests,
          status,
          paymentStatus,
          paymentMethod,
          specialRequests,
        };
      }
    )
  );
}

async function seedTables() {
  const chairsByIndex = [2, 2, 4, 4, 4, 6, 6, 8];
  for (let index = 0; index < 16; index++) {
    const number = index + 1;
    await TableModel.findOneAndUpdate(
      { number },
      { $set: { chairs: chairsByIndex[index % 8] } },
      { upsert: true, new: true }
    );
  }
  return TableModel.find().sort({ number: 1 });
}

async function seedTableBookings(users, tables) {
  const existing = await TableBookingModel.countDocuments();
  if (existing > 0) {
    console.log("Skipping table booking seed (bookings already exist).");
    return TableBookingModel.find();
  }
  const defs = [
    [1, 1, 1, 19, 2, 2, "confirmed", "paid"],
    [2, 2, 1, 20, 2, 4, "confirmed", "paid"],
    [3, 5, 2, 20, 2, 4, "confirmed", "unpaid"],
    [4, 7, 2, 21, 2, 6, "pending", "unpaid"],
    [5, 3, 3, 18, 2, 4, "completed", "paid"],
    [6, 9, 3, 19, 2, 2, "confirmed", "unpaid"],
    [7, 11, 4, 20, 2, 8, "confirmed", "paid"],
    [8, 4, -2, 19, 2, 4, "completed", "paid"],
    [9, 6, -1, 20, 2, 6, "cancelled", "unpaid"],
    [10, 8, 5, 21, 2, 2, "pending", "unpaid"],
  ];

  return TableBookingModel.create(
    defs.map(([userIndex, tableIndex, dayOffset, hour, durationHours, guests, status, paymentStatus]) => {
      const startTime = addDays(dayOffset, hour);
      return {
        tableNumber: status === "pending" ? null : tables[tableIndex].number,
        user: users[userIndex]._id,
        startTime,
        endTime: addHours(startTime, durationHours),
        guests,
        status,
        paymentStatus,
      };
    })
  );
}

async function seedCategories() {
  return Category.create([
    { label: "Appetizer", icon: "Salad", heroImg: categoryImages.Appetizer },
    { label: "Restaurant", icon: "UtensilsCrossed", heroImg: categoryImages.Restaurant },
    { label: "Desserts", icon: "CakeSlice", heroImg: categoryImages.Desserts },
    { label: "Drinks", icon: "GlassWater", heroImg: categoryImages.Drinks },
  ]);
}

async function seedMenu(adminUser, categories) {
  const categoryMap = Object.fromEntries(categories.map((category) => [category.label, category]));
  const defs = [
    // Appetizers (15)
    ["Stuffed Vine Leaves", "Herbed rice, lemon oil, and chilled yogurt sauce.", 145, "Appetizer", px("958545/pexels-photo-958545.jpeg")],
    ["Fattoush Royale", "Crisp greens, sumac pita, pomegranate, and citrus dressing.", 125, "Appetizer", px("1640772/pexels-photo-1640772.jpeg")],
    ["Beetroot Burrata", "Roasted beets, burrata, citrus segments, and pistachio.", 165, "Appetizer", px("769289/pexels-photo-769289.jpeg")],
    ["Mezze Symphony", "Hummus, muhammara, baba ghanoush, olives, and warm bread.", 210, "Appetizer", px("704569/pexels-photo-704569.jpeg")],
    ["Smoked Salmon Roses", "Crème fraîche, capers, rye crisps, and dill.", 185, "Appetizer", px("2085371/pexels-photo-2085371.jpeg")],
    ["Charred Halloumi", "Wild honey, pistachio, and lemon zest.", 155, "Appetizer", px("1352274/pexels-photo-1352274.jpeg")],
    ["Tuna Tataki", "Sesame crust, ponzu, avocado, and micro cilantro.", 195, "Appetizer", px("566345/pexels-photo-566345.jpeg")],
    ["Crab Louis Cocktail", "Louis sauce, gem lettuce, and brown butter crumbs.", 225, "Appetizer", px("842571/pexels-photo-842571.jpeg")],
    ["Wild Mushroom Crostini", "Truffle mascarpone, aged balsamic, and chives.", 135, "Appetizer", px("3611843/pexels-photo-3611843.jpeg")],
    ["Yellowtail Crudo", "Yuzu, chili oil, coriander, and crispy shallots.", 175, "Appetizer", px("67468/pexels-photo-67468.jpeg")],
    ["Burrata Caprese", "Heirloom tomatoes, basil oil, and aged balsamic.", 155, "Appetizer", px("1437267/pexels-photo-1437267.jpeg")],
    ["Crispy Calamari", "Smoked paprika aioli, preserved lemon, and parsley.", 165, "Appetizer", px("842142/pexels-photo-842142.jpeg")],
    ["Wagyu Beef Tartare", "Quail egg, cornichon, capers, and toasted brioche.", 245, "Appetizer", px("2097090/pexels-photo-2097090.jpeg")],
    ["Grilled Octopus", "Chickpea purée, chorizo oil, smoked paprika, and lemon.", 225, "Appetizer", px("1109197/pexels-photo-1109197.jpeg")],
    ["Artichoke Barigoule", "White wine braised hearts, herbs, and olive tapenade.", 155, "Appetizer", px("1640772/pexels-photo-1640772.jpeg")],
    // Restaurant / mains (15)
    ["Mirage Mixed Grill", "Kofta, lamb chop, chicken skewer, and saffron rice.", 420, "Restaurant", px("2097090/pexels-photo-2097090.jpeg")],
    ["Nile Sea Bass", "Pan-seared fillet, lemon butter, capers, and seasonal greens.", 445, "Restaurant", px("1109197/pexels-photo-1109197.jpeg")],
    ["Slow-Braised Lamb Shank", "Rosemary jus, fondant potato, and glazed carrots.", 385, "Restaurant", px("725997/pexels-photo-725997.jpeg")],
    ["Beef Tenderloin", "Peppercorn sauce, bone marrow butter, and pommes Anna.", 560, "Restaurant", px("3611843/pexels-photo-3611843.jpeg")],
    ["Wild Mushroom Risotto", "Black truffle oil, aged Parmesan, and crispy sage.", 280, "Restaurant", px("704569/pexels-photo-704569.jpeg")],
    ["Truffle Tagliatelle", "Fresh egg pasta, truffle butter, and pecorino.", 340, "Restaurant", px("3214164/pexels-photo-3214164.jpeg")],
    ["Duck Breast à l’Orange", "Confit leg croquette, endive, and grand jus.", 395, "Restaurant", px("2085371/pexels-photo-2085371.jpeg")],
    ["Herb-Crusted Rack of Lamb", "Ratatouille, red wine reduction, and mint oil.", 520, "Restaurant", px("566345/pexels-photo-566345.jpeg")],
    ["Lobster Thermidor", "Cognac cream, gratinée, and butter lettuce.", 680, "Restaurant", px("842571/pexels-photo-842571.jpeg")],
    ["Chicken Supreme", "Morel cream, wilted spinach, and pommes purée.", 265, "Restaurant", px("1352274/pexels-photo-1352274.jpeg")],
    ["Oven-Roasted Branzino", "Fennel pollen, citrus beurre blanc, and samphire.", 355, "Restaurant", px("1109197/pexels-photo-1109197.jpeg")],
    ["Vegetable Wellington", "Roasted roots, duxelles, puff pastry, and port jus.", 245, "Restaurant", px("1640772/pexels-photo-1640772.jpeg")],
    ["Osso Buco Milanese", "Saffron risotto, gremolata, and marrow jus.", 365, "Restaurant", px("725997/pexels-photo-725997.jpeg")],
    ["Pan-Seared Scallops", "Cauliflower purée, brown butter, capers, and chives.", 295, "Restaurant", px("842571/pexels-photo-842571.jpeg")],
    ["Moroccan-Spiced Quail", "Preserved lemon, honey glaze, couscous, and harissa yogurt.", 315, "Restaurant", px("1352274/pexels-photo-1352274.jpeg")],
    // Desserts (15)
    ["Valrhona Fondant", "Warm center, praline crumble, and malted cream.", 165, "Desserts", px("45202/brownie-dessert-cake-sweet-45202.jpeg")],
    ["Citrus Tart", "Meyer lemon curd, Italian meringue, and almond sablé.", 135, "Desserts", px("291528/pexels-photo-291528.jpeg")],
    ["Basbousa Royale", "Orange blossom syrup, pistachio, and clotted cream.", 115, "Desserts", px("958545/pexels-photo-958545.jpeg")],
    ["Pistachio Kunafa", "Crisp kadaif, sweet cheese, and rose syrup.", 145, "Desserts", px("769289/pexels-photo-769289.jpeg")],
    ["Seasonal Pavlova", "Crisp meringue, Chantilly, and market berries.", 150, "Desserts", px("1437267/pexels-photo-1437267.jpeg")],
    ["Arabic Coffee Profiteroles", "Cardamom pastry cream and date caramel.", 135, "Desserts", px("302899/pexels-photo-302899.jpeg")],
    ["Lemon Basil Sorbet", "Palette cleanser with olive oil crumble.", 95, "Desserts", px("67468/pexels-photo-67468.jpeg")],
    ["Dark Chocolate Soufflé", "Grand Marnier anglaise and cocoa nib.", 155, "Desserts", px("45202/brownie-dessert-cake-sweet-45202.jpeg")],
    ["Tiramisu al Mirage", "Mascarpone, espresso soak, and cocoa dust.", 140, "Desserts", px("842142/pexels-photo-842142.jpeg")],
    ["Raspberry Opera", "Joconde, buttercream, and glossy glaze.", 145, "Desserts", px("291528/pexels-photo-291528.jpeg")],
    ["Baked Alaska", "Torched meringue, vanilla parfait, and berry coulis.", 160, "Desserts", px("958545/pexels-photo-958545.jpeg")],
    ["Date Sticky Toffee", "Butterscotch sauce, pecan, and crème fraîche.", 125, "Desserts", px("769289/pexels-photo-769289.jpeg")],
    ["Mahalabia Rose", "Milk pudding, rose water, pistachio, and edible petals.", 95, "Desserts", px("1437267/pexels-photo-1437267.jpeg")],
    ["Salted Caramel Éclair", "Choux, vanilla diplomat, and glossy caramel glaze.", 125, "Desserts", px("842142/pexels-photo-842142.jpeg")],
    ["Fig and Mascarpone Parfait", "Honeycomb, aged balsamic pearls, and mint.", 115, "Desserts", px("67468/pexels-photo-67468.jpeg")],
    // Drinks (15)
    ["Mirage Spritz", "Aperitif, prosecco, citrus, and rosemary.", 98, "Drinks", px("1283219/pexels-photo-1283219.jpeg")],
    ["Sommelier’s Glass", "Rotating pour from our cellar list.", 85, "Drinks", px("1552639/pexels-photo-1552639.jpeg")],
    ["Single-Origin Espresso", "Rotating microlot, double shot.", 45, "Drinks", px("302899/pexels-photo-302899.jpeg")],
    ["Hibiscus Cooler", "Cold brew karkadeh, mint, and orange peel.", 75, "Drinks", px("1552639/pexels-photo-1552639.jpeg")],
    ["Mango Passion Fizz", "Mango, passion fruit, lime, and soda.", 88, "Drinks", px("1283219/pexels-photo-1283219.jpeg")],
    ["Palm Signature Latte", "Cardamom, cinnamon, and silky foam.", 72, "Drinks", px("302899/pexels-photo-302899.jpeg")],
    ["Elderflower Collins", "Gin, elderflower, cucumber, tonic.", 110, "Drinks", px("1283219/pexels-photo-1283219.jpeg")],
    ["Cold Brew Tonic", "Nitro cold brew, citrus oils, tonic.", 68, "Drinks", px("302899/pexels-photo-302899.jpeg")],
    ["Negroni Mirage", "Gin, vermouth, bitter orange, smoked ice.", 115, "Drinks", px("1552639/pexels-photo-1552639.jpeg")],
    ["Virgin Paloma", "Grapefruit, agave, lime, and sparkling water.", 62, "Drinks", px("1283219/pexels-photo-1283219.jpeg")],
    ["Spiced Chai Latte", "House spice blend, oat milk, honey.", 58, "Drinks", px("302899/pexels-photo-302899.jpeg")],
    ["Mineral Water Still / Sparkling", "Imported 750ml.", 35, "Drinks", px("1552639/pexels-photo-1552639.jpeg")],
    ["Fresh Orange & Carrot Juice", "Cold-pressed, no added sugar.", 55, "Drinks", px("67468/pexels-photo-67468.jpeg")],
    ["Iced Moroccan Mint Tea", "Gunpowder green, fresh mint, light sweetness.", 48, "Drinks", px("1283219/pexels-photo-1283219.jpeg")],
    ["Whisky Old Fashioned", "Single malt, demerara, orange bitters, smoked cherry.", 125, "Drinks", px("1552639/pexels-photo-1552639.jpeg")],
  ];

  return menuModel.create(
    defs.map(([name, description, price, category, image]) => ({
      name,
      description,
      price,
      category,
      categoryIcon: categoryMap[category].icon,
      categoryHeroImg: categoryMap[category].heroImg,
      image,
      available: true,
      createdBy: adminUser._id,
    }))
  );
}

async function seedRestaurantPage() {
  await restaurantPageModel.findOneAndUpdate(
    { key: "main" },
    {
      $set: {
        key: "main",
        heroImage: pc("262978/pexels-photo-262978.jpeg", 1920, 1080),
        interiorImage: pc("1640772/pexels-photo-1640772.jpeg", 1400, 1800),
        // Story column accents: food & tablescapes only (avoid portrait/lifestyle stock)
        detailA: pc("704569/pexels-photo-704569.jpeg", 1200, 1500),
        detailB: pc("958545/pexels-photo-958545.jpeg", 1200, 1500),
        diningImage: pc("1109197/pexels-photo-1109197.jpeg", 1400, 1750),
      },
    },
    { upsert: true, new: true }
  );
}

async function seedActivities(adminUser) {
  const defs = [
    ["balloon", "Rise Above Luxor", "Sunrise Hot Air Balloon Ride", "Early morning balloon journey over Luxor's temples and farmland.", activityImages.balloon, "CloudSun", "Luxor West Bank", 240, "per_person", 180, 24, "3 hrs", "24"],
    ["nile", "Golden Hour Sailing", "Private Nile Sunset Cruise", "Private sunset sail with canapes, music, and a relaxed river atmosphere.", activityImages.nile, "Ship", "Palm Mirage Marina", 690, "per_group", 90, 6, "90 min", "6"],
    ["heritage", "Walk Through History", "Karnak and Luxor Heritage Tour", "Curated guided tour through iconic temple landmarks with hotel transfer.", activityImages.heritage, "Landmark", "Karnak Temple District", 180, "per_person", 240, 18, "4 hrs", "18"],
    ["desert", "Into the Dunes", "Desert Safari and Bedouin Dinner", "Late-afternoon desert safari ending with a Bedouin-style dinner under the stars.", activityImages.desert, "Mountain", "Western Desert Route", 320, "per_person", 300, 14, "5 hrs", "14"],
    ["cultural", "Meet Local Traditions", "Egyptian Culture Evening", "Interactive evening with storytelling, tea rituals, and folk music.", activityImages.cultural, "Palette", "Palm Mirage Lounge", 110, "per_person", 120, 20, "2 hrs", "20"],
    ["culinary", "Cook with the Chef", "Chef's Table Culinary Workshop", "Hands-on session preparing a curated Egyptian-inspired menu.", activityImages.culinary, "ChefHat", "Studio Kitchen", 260, "per_person", 150, 10, "150 min", "10"],
    ["nile", "Sail at Sunrise", "Morning Felucca Discovery", "A calm sunrise sail with tea service and scenic Nile banks.", activityImages.nile, "Ship", "Luxor Corniche", 160, "per_person", 75, 10, "75 min", "10"],
    ["heritage", "Timeless West Bank", "Valley of the Kings Explorer", "A guided visit to royal tombs and West Bank highlights.", activityImages.heritage, "Landmark", "Valley of the Kings", 210, "per_person", 300, 16, "5 hrs", "16"],
    ["desert", "Sunset Through Sand", "Quad Bike Desert Escape", "A high-energy desert route with lookout stops and refreshments.", activityImages.desert, "Mountain", "Desert Outskirts", 275, "per_person", 180, 12, "3 hrs", "12"],
    ["cultural", "Stories and Craft", "Nubian Music and Art Night", "Relaxed cultural night with live performance and handmade art corners.", activityImages.cultural, "Palette", "Cultural Courtyard", 95, "per_person", 100, 24, "100 min", "24"],
    ["culinary", "Taste of Luxor", "Egyptian Street Food Tasting", "Guided tasting menu inspired by classic Egyptian street food favorites.", activityImages.culinary, "ChefHat", "Palm Food Studio", 135, "per_person", 90, 14, "90 min", "14"],
    ["balloon", "Golden Skies", "Sunset Balloon Panorama", "A softer balloon experience with panoramic desert and river scenery.", activityImages.balloon, "CloudSun", "Luxor Launch Field", 285, "per_person", 150, 20, "150 min", "20"],
    ["nile", "Private River Moments", "Luxury Dinner Cruise on the Nile", "Evening dinner cruise with plated menu, soft music, and premium service.", activityImages.nile, "Ship", "Palm Private Dock", 890, "per_group", 120, 8, "2 hrs", "8"],
    ["heritage", "Temple by Night", "Luxor Temple Evening Visit", "A beautifully lit temple visit designed for cooler evening exploration.", activityImages.heritage, "Landmark", "Luxor Temple", 140, "per_person", 120, 22, "2 hrs", "22"],
    ["desert", "Stargazing Beyond the City", "Desert Stars Camp Experience", "A quiet stargazing trip with telescopes, warm drinks, and lounge seating.", activityImages.desert, "Mountain", "Open Desert Camp", 360, "per_person", 240, 18, "4 hrs", "18"],
    ["cultural", "Refined Local Encounters", "Traditional Tea and Storytelling Salon", "An intimate salon-style experience around Egyptian tea and local stories.", activityImages.cultural, "Palette", "Palm Library Lounge", 80, "per_person", 75, 16, "75 min", "16"],
    ["culinary", "Bake and Share", "Oriental Pastry Masterclass", "Small-group pastry class focused on kunafa, basbousa, and plating details.", activityImages.culinary, "ChefHat", "Pastry Atelier", 190, "per_person", 105, 12, "105 min", "12"],
    ["balloon", "First Light Adventure", "Family Balloon Morning Experience", "Family-friendly balloon ride with smoother pacing and early breakfast boxes.", activityImages.balloon, "CloudSun", "Luxor West Launch Zone", 230, "per_person", 165, 18, "165 min", "18"],
  ];

  return activityModel.create(
    defs.map(([category, label, title, description, image, icon, location, basePrice, pricingType, durationMinutes, defaultCapacity, statValue, seatValue]) => ({
      category,
      label,
      title,
      description,
      image: { secure_url: image, public_id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
      attacthments: [
        { secure_url: image, public_id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-1` },
        { secure_url: image, public_id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-2` },
      ],
      stats: [
        { value: statValue, label: "Duration" },
        { value: seatValue, label: "Seats" },
      ],
      highlights: ["Hotel transfer", "Curated experience", "Professional host", "Photo-friendly route"],
      icon,
      location,
      basePrice,
      pricingType,
      durationMinutes,
      defaultCapacity,
      isActive: true,
      createdBy: adminUser._id,
    }))
  );
}

async function seedActivitySchedules(adminUser, activities) {
  const defs = [
    [0, 2, 5, 30, 3, 24, 18, 260, "scheduled", "Pickup starts 30 minutes before departure."],
    [0, 4, 5, 30, 3, 24, 0, 255, "full", "Popular sunrise slot, fully booked."],
    [0, 7, 5, 30, 3, 24, 10, 250, "scheduled", "Morning weather briefing included."],
    [1, 1, 18, 0, 1.5, 6, 3, 720, "scheduled", "Private route with onboard refreshments."],
    [1, 3, 18, 0, 1.5, 6, 2, 690, "scheduled", "Ideal for couples and small groups."],
    [1, 6, 18, 0, 1.5, 6, 6, 680, "scheduled", "Open evening departure."],
    [2, 2, 9, 0, 4, 18, 7, null, "scheduled", "Includes temple tickets and guide."],
    [2, 5, 9, 0, 4, 18, 12, 195, "scheduled", "Small-group comfort coach transfer."],
    [2, -4, 9, 0, 4, 18, 0, 180, "completed", "Completed tour kept for dashboard history."],
    [3, 3, 15, 30, 5, 14, 5, 335, "scheduled", "Dinner camp with folklore show."],
    [3, 8, 15, 30, 5, 14, 11, 320, "scheduled", "More relaxed dune route."],
    [4, 1, 17, 0, 2, 20, 12, null, "scheduled", "Traditional tea and calligraphy included."],
    [4, 7, 17, 0, 2, 20, 0, 105, "cancelled", "Cancelled due to private event booking."],
    [5, 2, 13, 0, 2.5, 10, 4, 280, "scheduled", "Hands-on session with tasting menu."],
    [5, 5, 13, 0, 2.5, 10, 0, 270, "full", "Full workshop with waiting list."],
  ];

  return activityScheduleModel.create(
    defs.map(([activityIndex, dayOffset, hour, minute, durationHours, capacity, availableSeats, priceOverride, status, notes]) => {
      const start = addDays(dayOffset, hour, minute);
      const end = addHours(start, durationHours);
      return {
        activity: activities[activityIndex]._id,
        date: start,
        startTime: time(hour, minute),
        endTime: time(end.getHours(), end.getMinutes()),
        capacity,
        availableSeats,
        priceOverride,
        status,
        notes,
        createdBy: adminUser._id,
      };
    })
  );
}

async function seedActivityBookings(users, activities, schedules) {
  const defs = [
    [1, 0, 0, 2, 260, "per_person", "confirmed", "paid", "+201001110001", "Window side basket if possible", ""],
    [2, 1, 3, 1, 720, "per_group", "confirmed", "paid", "+201001110002", "Anniversary setup requested", ""],
    [3, 2, 6, 3, 180, "per_person", "pending", "unpaid", "+201001110003", "Need Arabic-speaking guide", ""],
    [4, 3, 9, 2, 335, "per_person", "confirmed", "paid", "+201001110004", "Vegetarian dinner preferred", ""],
    [5, 4, 11, 4, 110, "per_person", "confirmed", "paid", "+201001110005", "Traveling with children", ""],
    [6, 5, 13, 2, 280, "per_person", "pending", "unpaid", "+201001110006", "No seafood ingredients please", ""],
    [7, 0, 1, 2, 255, "per_person", "confirmed", "paid", "+201001110007", "First-time balloon ride", ""],
    [8, 1, 4, 1, 690, "per_group", "cancelled", "refunded", "+201001110008", "Had to leave early", "Schedule conflict with departure flight"],
    [9, 2, 8, 2, 180, "per_person", "completed", "paid", "+201001110009", "Great guide experience", ""],
    [10, 4, 12, 2, 105, "per_person", "rejected", "refunded", "+971501230001", "Wanted another date", "Activity was cancelled"],
    [11, 5, 14, 2, 270, "per_person", "confirmed", "paid", "+962790000001", "Workshop for a couple", ""],
  ];

  return activityBookingModel.create(
    defs.map(([userIndex, activityIndex, scheduleIndex, guests, unitPrice, pricingType, status, paymentStatus, contactPhone, notes, cancellationReason]) => ({
      user: users[userIndex]._id,
      activity: activities[activityIndex]._id,
      schedule: schedules[scheduleIndex]._id,
      guests,
      unitPrice,
      totalPrice: pricingType === "per_group" ? unitPrice : unitPrice * guests,
      pricingType,
      bookingDate: schedules[scheduleIndex].date,
      startTime: schedules[scheduleIndex].startTime,
      endTime: schedules[scheduleIndex].endTime,
      status,
      paymentStatus,
      contactPhone,
      notes,
      cancellationReason,
    }))
  );
}

/** Ensures every document in `bookings` has a valid paymentStatus (legacy rows). */
async function backfillRestaurantBookingPaymentStatus() {
  const result = await TableBookingModel.updateMany(
    {
      $or: [{ paymentStatus: { $exists: false } }, { paymentStatus: null }],
    },
    { $set: { paymentStatus: "unpaid" } }
  );
  if (result.modifiedCount > 0) {
    console.log(`Backfill: set paymentStatus=unpaid on ${result.modifiedCount} restaurant booking(s).`);
  }
}

async function runMenuOnly() {
  if (!dbUrl) {
    throw new Error("DB_URL is missing in src/config/.env.dev");
  }
  await mongoose.connect(dbUrl);
  console.log(`Connected to ${dbUrl}`);
  await backfillRestaurantBookingPaymentStatus();
  console.log("Menu-only: clearing Menu, Categories, RestaurantPage (tables & bookings unchanged).");
  await menuModel.deleteMany({});
  await Category.deleteMany({});
  await restaurantPageModel.deleteMany({});
  const admin = await userModel.findOne({ role: roleTypes.admin });
  if (!admin) {
    throw new Error("No admin user in DB. Run full seed once: node scripts/seed-local-data.js");
  }
  const categories = await seedCategories();
  const menuItems = await seedMenu(admin, categories);
  await seedRestaurantPage();
  console.log("Menu-only seed completed.");
  console.log(JSON.stringify({ categories: categories.length, menuItems: menuItems.length }, null, 2));
}

async function main() {
  if (!dbUrl) {
    throw new Error("DB_URL is missing in src/config/.env.dev");
  }

  await mongoose.connect(dbUrl);
  console.log(`Connected to ${dbUrl}`);

  await resetCollections();

  const hotel = await seedHotel();
  const users = await seedUsers();
  const facilities = await seedFacilities();
  const roomAmenities = await seedRoomAmenities();
  const rooms = await seedRooms(facilities, roomAmenities);
  const roomBookings = await seedRoomBookings(users, rooms);
  const tables = await seedTables();
  const tableBookings = await seedTableBookings(users, tables);
  const categories = await seedCategories();
  const menuItems = await seedMenu(users[0], categories);
  await seedRestaurantPage();
  const activities = await seedActivities(users[0]);
  const schedules = await seedActivitySchedules(users[0], activities);
  const activityBookings = await seedActivityBookings(users, activities, schedules);

  await backfillRestaurantBookingPaymentStatus();

  console.log("Large local seed completed successfully.");
  console.log(JSON.stringify({
    hotel: hotel.name,
    users: users.length,
    facilities: facilities.length,
    roomAmenities: roomAmenities.length,
    rooms: rooms.length,
    roomBookings: roomBookings.length,
    tables: tables.length,
    tableBookings: tableBookings.length,
    categories: categories.length,
    menuItems: menuItems.length,
    activities: activities.length,
    schedules: schedules.length,
    activityBookings: activityBookings.length,
    dashboardLogin: { email: "admin.local@palmhotel.com", password: "Admin123!" },
  }, null, 2));
}

const menuOnly = process.argv.includes("--menu-only");

(menuOnly ? runMenuOnly() : main())
  .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
