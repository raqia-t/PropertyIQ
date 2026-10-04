"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Upload,
  Sparkles,
  Building,
  MapPin,
  Image as ImageIcon,
  Trash2,
  Star,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
} from "lucide-react";

export interface PropertyPhoto {
  id: string;
  file?: File;
  previewUrl: string;
  name: string;
  size: string;
  category: string;
  isPrimary: boolean;
  aiTags: string[];
}

const ROOM_CATEGORIES = [
  "Exterior / Elevation",
  "Living Room / Hall",
  "Kitchen",
  "Master Bedroom",
  "Bedroom",
  "Bathroom / Powder Room",
  "Dining Room",
  "Terrace / Garden",
  "Floor Plan / Layout",
  "Other",
];

const RECOMMENDED_ROOMS = [
  { label: "Front Elevation", key: "Exterior" },
  { label: "Living Room", key: "Living" },
  { label: "Kitchen", key: "Kitchen" },
  { label: "Master Bed", key: "Master" },
  { label: "Washroom", key: "Bath" },
];

const SAMPLE_PHOTOS: Omit<PropertyPhoto, "id">[] = [
  {
    previewUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    name: "Front_Elevation_Modern_Spanish.jpg",
    size: "1.4 MB",
    category: "Exterior / Elevation",
    isPrimary: true,
    aiTags: ["Front Elevation", "Spanish Design", "Modern Driveway"],
  },
  {
    previewUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80",
    name: "Living_Room_Main_Lounge.jpg",
    size: "1.8 MB",
    category: "Living Room / Hall",
    isPrimary: false,
    aiTags: ["Porcelain Tile", "False Ceiling", "Natural Light"],
  },
  {
    previewUrl: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80",
    name: "Chef_Kitchen_Spanish_Marble.jpg",
    size: "1.6 MB",
    category: "Kitchen",
    isPrimary: false,
    aiTags: ["Spanish Marble", "Fitted Cabinets", "Exhaust Duct"],
  },
  {
    previewUrl: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80",
    name: "Master_Bed_Ensuite.jpg",
    size: "1.5 MB",
    category: "Master Bedroom",
    isPrimary: false,
    aiTags: ["Solid Ash Wood", "Attached Bath", "Wardrobe Space"],
  },
  {
    previewUrl: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
    name: "Luxury_Washroom_Grohe_Vanity.jpg",
    size: "1.2 MB",
    category: "Bathroom / Powder Room",
    isPrimary: false,
    aiTags: ["Grohe Fittings", "Glass Partition", "LED Vanity"],
  },
];

function detectCategoryFromFilename(filename: string): string {
  const f = filename.toLowerCase();
  if (f.includes("exterior") || f.includes("front") || f.includes("elevation") || f.includes("facade") || f.includes("gate")) {
    return "Exterior / Elevation";
  }
  if (f.includes("living") || f.includes("lounge") || f.includes("hall") || f.includes("tv")) {
    return "Living Room / Hall";
  }
  if (f.includes("kitchen") || f.includes("cook")) {
    return "Kitchen";
  }
  if (f.includes("master") || (f.includes("bed") && f.includes("1"))) {
    return "Master Bedroom";
  }
  if (f.includes("bed")) {
    return "Bedroom";
  }
  if (f.includes("bath") || f.includes("wash") || f.includes("toilet") || f.includes("powder")) {
    return "Bathroom / Powder Room";
  }
  if (f.includes("dining")) {
    return "Dining Room";
  }
  if (f.includes("terrace") || f.includes("balcony") || f.includes("garden") || f.includes("lawn") || f.includes("roof")) {
    return "Terrace / Garden";
  }
  if (f.includes("plan") || f.includes("map") || f.includes("blueprint")) {
    return "Floor Plan / Layout";
  }
  return "Living Room / Hall";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewPropertyPage() {
  const [purpose, setPurpose] = useState("Sale");
  const [propertyType, setPropertyType] = useState("House");
  const [city, setCity] = useState("Lahore");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [landArea, setLandArea] = useState("5");
  const [landUnit, setLandUnit] = useState("Marla");
  const [bedrooms, setBedrooms] = useState("3");
  const [bathrooms, setBathrooms] = useState("3");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Photos State
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const processFiles = (fileList: File[]) => {
    const validImages = fileList.filter((f) => f.type.startsWith("image/"));
    if (validImages.length === 0) return;

    const newPhotos: PropertyPhoto[] = validImages.map((file, i) => {
      const category = detectCategoryFromFilename(file.name);
      let aiTags: string[] = [];
      if (category.includes("Exterior")) {
        aiTags = ["Front Elevation", "Spanish Design", "Modern Driveway"];
      } else if (category.includes("Living")) {
        aiTags = ["Porcelain Tile", "False Ceiling", "Natural Light"];
      } else if (category.includes("Kitchen")) {
        aiTags = ["Spanish Marble", "Fitted Cabinets", "Exhaust Duct"];
      } else if (category.includes("Bed")) {
        aiTags = ["Solid Ash Wood", "Attached Bath", "Wardrobe Space"];
      } else if (category.includes("Bath")) {
        aiTags = ["Grohe Fittings", "Glass Partition", "LED Vanity"];
      } else {
        aiTags = ["AI Verified", "High Resolution"];
      }

      return {
        id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        size: formatFileSize(file.size),
        category,
        isPrimary: photos.length === 0 && i === 0,
        aiTags,
      };
    });

    setPhotos((prev) => {
      const combined = [...prev, ...newPhotos];
      if (!combined.some((p) => p.isPrimary) && combined.length > 0) {
        combined[0].isPrimary = true;
      }
      return combined;
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setIsDragging(false);
      dragCounter.current = 0;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const setPrimaryPhoto = (id: string) => {
    setPhotos((prev) =>
      prev.map((p) => ({
        ...p,
        isPrimary: p.id === id,
      }))
    );
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (filtered.length > 0 && !filtered.some((p) => p.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const updatePhotoCategory = (id: string, category: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, category } : p))
    );
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    setPhotos((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const loadSamplePhotos = () => {
    const samples: PropertyPhoto[] = SAMPLE_PHOTOS.map((s, idx) => ({
      ...s,
      id: `sample-${Date.now()}-${idx}`,
      isPrimary: idx === 0,
    }));
    setPhotos(samples);
  };

  const coveredRoomsCount = RECOMMENDED_ROOMS.filter((room) =>
    photos.some((p) => p.category.toLowerCase().includes(room.key.toLowerCase()))
  ).length;
  const coveragePercentage = Math.round((coveredRoomsCount / RECOMMENDED_ROOMS.length) * 100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const primaryPhoto = photos.find((p) => p.isPrimary) || photos[0];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <Link
          href="/agent"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">Create New Property Listing</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          List a residential or commercial property with AI listing optimization, drag-and-drop photos, and automatic valuation scenarios.
        </p>
      </div>

      {submitted ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-xl font-bold text-emerald-950">Property Published Successfully!</h2>
            <p className="text-xs sm:text-sm text-emerald-800 max-w-md mx-auto">
              Your listing is live on PropertyIQ AI Pakistan. The AI Property Intelligence engine has automatically calculated market valuation and rent estimates.
            </p>
          </div>

          {/* Published Listing Summary Card */}
          <div className="bg-white rounded-xl border border-emerald-200 p-4 max-w-lg mx-auto shadow-sm flex flex-col sm:flex-row gap-4 items-center">
            {primaryPhoto ? (
              <div className="w-28 h-24 rounded-lg overflow-hidden shrink-0 bg-slate-100 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={primaryPhoto.previewUrl}
                  alt={primaryPhoto.name}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 bg-slate-900/80 text-[10px] text-white font-bold px-1.5 py-0.5 rounded">
                  {photos.length} Photo{photos.length === 1 ? "" : "s"}
                </span>
              </div>
            ) : (
              <div className="w-28 h-24 rounded-lg shrink-0 bg-slate-100 flex items-center justify-center text-slate-400">
                <ImageIcon className="w-8 h-8" />
              </div>
            )}

            <div className="flex-1 text-left space-y-1">
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase">
                {purpose} • {propertyType}
              </span>
              <h3 className="font-bold text-sm text-slate-900 line-clamp-1">
                {title || `${landArea} ${landUnit} ${propertyType} in ${area || city}`}
              </h3>
              <p className="text-xs text-slate-500">
                {area ? `${area}, ` : ""}{city} • {landArea} {landUnit}
              </p>
              <p className="text-sm font-extrabold text-emerald-700">
                {price ? `PKR ${Number(price).toLocaleString()}` : "Price on Request"}
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              href="/search"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition shadow"
            >
              View in Search Results
            </Link>
            <button
              onClick={() => {
                setSubmitted(false);
                setPhotos([]);
                setTitle("");
                setDescription("");
                setArea("");
                setAddress("");
                setPrice("");
              }}
              className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-6 py-2.5 rounded-xl transition hover:bg-slate-50"
            >
              Add Another Listing
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {/* Section: Purpose & Type */}
          <div className="space-y-4 border-b border-slate-100 pb-6">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-600" />
              <span>Property Type & Purpose</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Listing Purpose</label>
                <div className="mt-1 flex gap-3">
                  {["Sale", "Rent"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPurpose(p)}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                        purpose === p
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      For {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Property Category</label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                >
                  <option value="House">House / Villa</option>
                  <option value="Apartment">Apartment / Flat</option>
                  <option value="Plot">Residential Plot</option>
                  <option value="Commercial">Commercial Shop / Office</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Location */}
          <div className="space-y-4 border-b border-slate-100 pb-6">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Location Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                >
                  <option value="Lahore">Lahore</option>
                  <option value="Islamabad">Islamabad</option>
                  <option value="Rawalpindi">Rawalpindi</option>
                  <option value="Karachi">Karachi</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Society / Area Name</label>
                <input
                  type="text"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. DHA Phase 6, Bahria Town, Gulberg"
                  className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Exact Street Address (Optional)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. House 42, Street 8, Block L"
                  className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Section: Pricing & Dimensions */}
          <div className="space-y-4 border-b border-slate-100 pb-6">
            <h3 className="font-bold text-sm text-slate-900">Pricing & Size (Pakistan Standard)</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Asking Price (PKR)</label>
                <input
                  type="number"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 25000000 (PKR 2.5 Crore)"
                  className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Land Area Size</label>
                <input
                  type="number"
                  required
                  value={landArea}
                  onChange={(e) => setLandArea(e.target.value)}
                  className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Unit of Measurement</label>
                <select
                  value={landUnit}
                  onChange={(e) => setLandUnit(e.target.value)}
                  className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                >
                  <option value="Marla">Marla</option>
                  <option value="Kanal">Kanal</option>
                  <option value="SqYards">Sq. Yards</option>
                  <option value="SqFt">Sq. Feet</option>
                </select>
              </div>

              {propertyType !== "Plot" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Bedrooms</label>
                    <select
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((b) => (
                        <option key={b} value={b}>{b} Beds</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">Bathrooms</label>
                    <select
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value)}
                      className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((b) => (
                        <option key={b} value={b}>{b} Baths</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section: Title & Description */}
          <div className="space-y-4 border-b border-slate-100 pb-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Title & Description</h3>
              <button
                type="button"
                onClick={() => {
                  const pkrPrice = Number(price) >= 10000000 ? `PKR ${(Number(price)/10000000).toFixed(2)} Crore` : `PKR ${(Number(price)/100000).toFixed(0)} Lakh`;
                  setTitle(`Brand New ${landArea} ${landUnit} Modern Designer ${propertyType} in ${area || "Prime Location"}, ${city}`);
                  setDescription(
                    `PropertyIQ AI Verified Listing: Spectacular newly constructed ${landArea} ${landUnit} designer ${propertyType.toLowerCase()} ` +
                    `located in prime ${area || "peaceful sector"}, ${city}. Features ${bedrooms} spacious master bedrooms with attached luxury baths, ` +
                    `open-concept designer kitchen, drawing & dining halls, and servant quarters. ` +
                    `Offered at an attractive valuation of ${pkrPrice || "competitive market price"}. Clean documentation with independent verification available.`
                  );
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-purple-100 hover:bg-purple-200 text-purple-800 px-3 py-1.5 rounded-lg transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Auto-Draft with AI Assistant</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Listing Headline</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Brand New 5 Marla Modern Spanish House in Bahria Town"
                className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Detailed Description</label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe key features, tiles, woodwork, proximity to main boulevard, amenities..."
                className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Section: Media Upload & Gallery */}
          <div className="space-y-4 border-b border-slate-100 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>Property Photos & Media</span>
                  {photos.length > 0 && (
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                      {photos.length} uploaded
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Drag and drop multiple property photos. Select room categories and assign a cover photo.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-700 font-semibold flex items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>AI Room Tagging Active</span>
                </span>
                {photos.length === 0 && (
                  <button
                    type="button"
                    onClick={loadSamplePhotos}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Try Sample Photos</span>
                  </button>
                )}
              </div>
            </div>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processFiles(Array.from(e.target.files));
                  e.target.value = "";
                }
              }}
            />

            {/* Interactive Drag & Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer select-none ${
                isDragging
                  ? "border-emerald-500 bg-emerald-50/80 ring-4 ring-emerald-500/20 scale-[1.005]"
                  : "border-slate-300 hover:border-emerald-500 hover:bg-slate-50/60 bg-slate-50/30"
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-2.5 pointer-events-none">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform ${
                    isDragging ? "bg-emerald-600 text-white scale-110 animate-bounce" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  <Upload className="w-6 h-6" />
                </div>

                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    {isDragging ? "Release to drop photos here!" : "Drag & Drop Photos Here or Browse"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select JPG, PNG, or WEBP images up to 25MB each (multiple photos supported)
                  </p>
                </div>

                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-lg shadow-sm transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose Files from Device</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Recommended Room Coverage Checklist */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Completeness Checklist:
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  {coveredRoomsCount}/{RECOMMENDED_ROOMS.length} Key Rooms Covered ({coveragePercentage}%)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {RECOMMENDED_ROOMS.map((room) => {
                  const isCovered = photos.some((p) => p.category.toLowerCase().includes(room.key.toLowerCase()));
                  return (
                    <span
                      key={room.label}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border transition ${
                        isCovered
                          ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                          : "bg-white border-slate-200 text-slate-400"
                      }`}
                    >
                      {isCovered ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                      )}
                      <span>{room.label}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Photo Gallery Grid */}
            {photos.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold">
                    Gallery ({photos.length} photo{photos.length === 1 ? "" : "s"} uploaded)
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add More Photos</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotos([])}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {photos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className={`group relative bg-white rounded-xl border overflow-hidden shadow-sm transition hover:shadow-md ${
                        photo.isPrimary
                          ? "border-emerald-500 ring-2 ring-emerald-500/30"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {/* Photo Thumbnail */}
                      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.previewUrl}
                          alt={photo.name}
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                        />

                        {/* Top Badges and Actions */}
                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
                          {photo.isPrimary ? (
                            <span className="pointer-events-auto bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                              <Star className="w-3 h-3 fill-white" />
                              <span>Primary Cover</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPrimaryPhoto(photo.id)}
                              className="pointer-events-auto bg-slate-900/70 hover:bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm opacity-90 hover:opacity-100 transition"
                            >
                              <Star className="w-3 h-3" />
                              <span>Set as Cover</span>
                            </button>
                          )}

                          <div className="flex items-center gap-1 pointer-events-auto">
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => movePhoto(idx, -1)}
                                title="Move Left"
                                className="w-6 h-6 rounded-md bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center transition"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {idx < photos.length - 1 && (
                              <button
                                type="button"
                                onClick={() => movePhoto(idx, 1)}
                                title="Move Right"
                                className="w-6 h-6 rounded-md bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center transition"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removePhoto(photo.id)}
                              title="Delete photo"
                              className="w-6 h-6 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* File Size Overlay */}
                        <div className="absolute bottom-2 right-2 bg-slate-900/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                          {photo.size}
                        </div>
                      </div>

                      {/* Photo Details & Controls */}
                      <div className="p-3 space-y-2 bg-white">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Room Category
                          </label>
                          <select
                            value={photo.category}
                            onChange={(e) => updatePhotoCategory(photo.id, e.target.value)}
                            className="w-full text-xs font-semibold mt-1 p-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 text-slate-800"
                          >
                            {ROOM_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* AI Detected Feature Tags */}
                        {photo.aiTags && photo.aiTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {photo.aiTags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded"
                              >
                                ✨ {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="text-[10px] text-slate-400 truncate" title={photo.name}>
                          {photo.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3.5 rounded-xl transition shadow-md flex items-center justify-center gap-2"
          >
            <span>Publish Listing to PropertyIQ AI</span>
            {photos.length > 0 && (
              <span className="bg-emerald-700 text-emerald-100 text-xs px-2 py-0.5 rounded-full">
                with {photos.length} photo{photos.length === 1 ? "" : "s"}
              </span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
