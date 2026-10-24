"use client";

import { useState, useRef, useEffect } from "react";
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
  Loader2,
  FileText,
  Shield,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PropertyLocationPicker from "@/components/maps/PropertyLocationPicker";
import { defaultCenterForCity, privacyLevelFromShowPin } from "@/lib/maps";
import {
  REQUIRED_VERIFICATION_DOCS,
  VERIFICATION_DOC_TYPES,
} from "@/lib/verificationDocuments";

export interface PropertyPhoto {
  id: string;
  file?: File;
  previewUrl: string;
  name: string;
  size: string;
  category: string;
  isPrimary: boolean;
  aiTags: string[];
  classifySource?: string | null;
  classifying?: boolean;
}

interface EvidenceDraft {
  id: string;
  file: File;
  documentType: string;
}

const EVIDENCE_TYPES = VERIFICATION_DOC_TYPES;

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

function defaultTagsForCategory(category: string): string[] {
  if (category.includes("Exterior")) return ["Front Elevation", "Street view"];
  if (category.includes("Living")) return ["Living area", "Natural light"];
  if (category.includes("Kitchen")) return ["Kitchen", "Cabinets"];
  if (category.includes("Bed")) return ["Bedroom", "Wardrobe space"];
  if (category.includes("Bath")) return ["Washroom", "Fixtures"];
  return ["Listing photo"];
}

/** Compress image for vision API (max edge 1280px, JPEG). Returns data URL. */
async function fileToVisionDataUrl(file: File, maxEdge = 1280): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // Fallback: raw FileReader
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mapPropertyType(uiType: string): string {
  switch (uiType) {
    case "Apartment":
      return "ApartmentFlat";
    case "Commercial":
      return "CommercialShop";
    case "Plot":
      return "Plot";
    default:
      return "House";
  }
}

function uiPropertyType(apiType: string): string {
  switch (apiType) {
    case "ApartmentFlat":
      return "Apartment";
    case "CommercialShop":
      return "Commercial";
    case "Plot":
      return "Plot";
    default:
      return "House";
  }
}

function uiMediaCategory(apiCategory: string): string {
  switch (apiCategory) {
    case "Exterior":
      return "Exterior / Elevation";
    case "LivingRoom":
      return "Living Room / Hall";
    case "Kitchen":
      return "Kitchen";
    case "MasterBedroom":
      return "Master Bedroom";
    case "Bedroom":
      return "Bedroom";
    case "Bathroom":
      return "Bathroom / Powder Room";
    case "DiningRoom":
      return "Dining Room";
    case "Terrace":
      return "Terrace / Garden";
    case "FloorPlan":
      return "Floor Plan / Layout";
    default:
      return "Other";
  }
}

function mapMediaCategory(uiCategory: string): string {
  if (uiCategory.includes("Exterior")) return "Exterior";
  if (uiCategory.includes("Living")) return "LivingRoom";
  if (uiCategory.includes("Kitchen")) return "Kitchen";
  if (uiCategory.includes("Master")) return "MasterBedroom";
  if (uiCategory.includes("Bedroom")) return "Bedroom";
  if (uiCategory.includes("Bath")) return "Bathroom";
  if (uiCategory.includes("Dining")) return "DiningRoom";
  if (uiCategory.includes("Terrace") || uiCategory.includes("Garden")) return "Terrace";
  if (uiCategory.includes("Floor Plan")) return "FloorPlan";
  return "Other";
}

function provinceForCity(city: string): string {
  if (city === "Karachi") return "Sindh";
  if (city === "Islamabad" || city === "Rawalpindi") return "Islamabad Capital Territory";
  return "Punjab";
}

export default function PropertyListingPage({ propertyId }: { propertyId?: string }) {
  const isEditMode = Boolean(propertyId);
  const { user, isAuthenticated, isHydrated, authFetch } = useAuth();
  const [loadingProperty, setLoadingProperty] = useState(isEditMode);
  const [purpose, setPurpose] = useState("Sale");
  const [propertyType, setPropertyType] = useState("House");
  const [city, setCity] = useState("Lahore");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showPinToCustomers, setShowPinToCustomers] = useState(true);
  const [price, setPrice] = useState("");
  const [landArea, setLandArea] = useState("5");
  const [landUnit, setLandUnit] = useState("Marla");
  const [bedrooms, setBedrooms] = useState("3");
  const [bathrooms, setBathrooms] = useState("3");
  const [constructionYear, setConstructionYear] = useState(
    String(new Date().getFullYear())
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expectedRentMin, setExpectedRentMin] = useState<number | null>(null);
  const [expectedRentMax, setExpectedRentMax] = useState<number | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [scenarioSummary, setScenarioSummary] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [evidenceDocs, setEvidenceDocs] = useState<EvidenceDraft[]>([]);
  const [evidenceType, setEvidenceType] = useState("SaleFard");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (!propertyId || !isHydrated || !isAuthenticated) {
      if (isHydrated && isEditMode && !isAuthenticated) setLoadingProperty(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoadingProperty(true);
      setSubmitError(null);
      try {
        const res = await authFetch(`/api/properties/${propertyId}`);
        if (!res.ok) {
          throw new Error(
            res.status === 403 || res.status === 401
              ? "Sign in as the listing agent to edit this property."
              : `Could not load property (${res.status}).`
          );
        }
        const data = (await res.json()) as {
          title: string;
          description: string;
          purpose: string;
          propertyType: string;
          city: string;
          area: string;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          privacyLevel?: string;
          price: number;
          bedrooms?: number | null;
          bathrooms?: number | null;
          landArea: number;
          landAreaUnit: string;
          constructionYear?: number | null;
          expectedRentMin?: number | null;
          expectedRentMax?: number | null;
          media?: Array<{
            id: string;
            url: string;
            category: string;
            isPrimary: boolean;
            aiTags?: string | null;
          }>;
          agent?: { id: string } | null;
        };

        if (cancelled) return;

        if (user?.userId && data.agent?.id && data.agent.id !== user.userId) {
          throw new Error("You can only edit listings that belong to your agent account.");
        }

        setPurpose(data.purpose === "Rent" ? "Rent" : "Sale");
        setPropertyType(uiPropertyType(data.propertyType));
        setCity(data.city || "Lahore");
        setArea(data.area || "");
        setAddress(data.address ?? "");
        setLatitude(data.latitude ?? null);
        setLongitude(data.longitude ?? null);
        setShowPinToCustomers(data.privacyLevel !== "ApproximateArea");
        setPrice(String(data.price ?? ""));
        setLandArea(String(data.landArea ?? "5"));
        setLandUnit(data.landAreaUnit || "Marla");
        setBedrooms(data.bedrooms != null ? String(data.bedrooms) : "3");
        setBathrooms(data.bathrooms != null ? String(data.bathrooms) : "3");
        setConstructionYear(
          data.constructionYear != null
            ? String(data.constructionYear)
            : String(new Date().getFullYear())
        );
        setTitle(data.title || "");
        setDescription(data.description || "");
        setExpectedRentMin(data.expectedRentMin ?? null);
        setExpectedRentMax(data.expectedRentMax ?? null);

        const apiOrigin =
          typeof window !== "undefined" && window.location.hostname === "localhost"
            ? "http://localhost:5000"
            : "";

        const loadedPhotos: PropertyPhoto[] = (data.media ?? []).map((m, idx) => ({
          id: m.id,
          previewUrl: m.url.startsWith("http") ? m.url : `${apiOrigin}${m.url}`,
          name: m.category,
          size: "—",
          category: uiMediaCategory(m.category),
          isPrimary: m.isPrimary,
          aiTags: m.aiTags ? m.aiTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        }));
        if (loadedPhotos.length > 0 && !loadedPhotos.some((p) => p.isPrimary)) {
          loadedPhotos[0].isPrimary = true;
        }
        setPhotos(loadedPhotos);
      } catch (e: unknown) {
        if (!cancelled) {
          setSubmitError(e instanceof Error ? e.message : "Failed to load property for editing.");
        }
      } finally {
        if (!cancelled) setLoadingProperty(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId, isHydrated, isAuthenticated, authFetch, isEditMode, user?.userId]);

  const classifyPhoto = async (photoId: string, file: File) => {
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 28_000);
    try {
      const dataUrl = await fileToVisionDataUrl(file);
      const res = await authFetch("/api/ai/classify-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrl,
          filename: file.name,
          propertyType: mapPropertyType(propertyType),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photoId
              ? { ...p, classifySource: "filename_fallback", classifying: false }
              : p
          )
        );
        return;
      }
      const sourceHdr =
        res.headers.get("X-PropertyIQ-Image-Source") ||
        res.headers.get("x-propertyiq-image-source");
      const data = (await res.json()) as {
        classifiedRoom?: string;
        uiCategory?: string;
        confidence?: number;
        detectedFeatures?: string[];
        missingMediaSuggestions?: string[];
        source?: string | null;
      };
      const tags = (data.detectedFeatures ?? []).slice(0, 6);
      const via = sourceHdr || data.source || "ai";
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? {
                ...p,
                category: data.uiCategory || p.category,
                aiTags: tags.length ? tags : p.aiTags,
                classifySource: via,
                classifying: false,
              }
            : p
        )
      );
      if (data.missingMediaSuggestions?.length) {
        setAiMessage(
          `Photo AI (${via}): ${data.classifiedRoom || "classified"}. Tip: ${data.missingMediaSuggestions[0]}`
        );
      }
    } catch {
      // Keep filename/category tags already set in processFiles.
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? { ...p, classifySource: "filename_fallback", classifying: false }
            : p
        )
      );
    } finally {
      clearTimeout(abortTimer);
    }
  };

  const processFiles = (fileList: File[]) => {
    const validImages = fileList.filter((f) => f.type.startsWith("image/"));
    if (validImages.length === 0) return;

    const newPhotos: PropertyPhoto[] = validImages.map((file, i) => {
      const category = detectCategoryFromFilename(file.name);
      return {
        id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        size: formatFileSize(file.size),
        category,
        isPrimary: photos.length === 0 && i === 0,
        aiTags: defaultTagsForCategory(category),
        classifySource: "pending",
        classifying: true,
      };
    });

    setPhotos((prev) => {
      const combined = [...prev, ...newPhotos];
      if (!combined.some((p) => p.isPrimary) && combined.length > 0) {
        combined[0].isPrimary = true;
      }
      return combined;
    });

    // Phase C: classify each new upload (vision or filename fallback)
    for (const photo of newPhotos) {
      if (photo.file) void classifyPhoto(photo.id, photo.file);
    }
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

  const resetForm = () => {
    setSubmitted(false);
    setCreatedPropertyId(null);
    setSubmitError(null);
    setPhotos([]);
    setEvidenceDocs([]);
    setEvidenceType("SaleFard");
    setTitle("");
    setDescription("");
    setExpectedRentMin(null);
    setExpectedRentMax(null);
    setAiMessage(null);
    setScenarioSummary(null);
    setArea("");
    setAddress("");
    setPrice("");
  };

  const generateAiDraft = async () => {
    if (!isAuthenticated) {
      setAiMessage("Sign in as an agent to use AI listing draft.");
      return;
    }
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setAiMessage("Enter a valid asking price before generating a draft.");
      return;
    }
    if (!area.trim()) {
      setAiMessage("Enter an area / locality before generating a draft.");
      return;
    }

    setDraftBusy(true);
    setAiMessage(null);
    try {
      const res = await authFetch("/api/ai/generate-listing-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyType: mapPropertyType(propertyType),
          city,
          area: area.trim(),
          size: Number(landArea) || 1,
          sizeUnit: landUnit,
          price: parsedPrice,
          bedrooms: propertyType === "Plot" ? null : Number(bedrooms) || null,
          bathrooms: propertyType === "Plot" ? null : Number(bathrooms) || null,
          furnishing: "SemiFurnished",
          userNotes: address.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          (err as { message?: string }).message ||
          (res.status === 504
            ? "AI draft timed out. Keep Ollama running and try again (first run can take 1–2 minutes)."
            : `Draft failed (${res.status}). Is the API and AI service running?`);
        throw new Error(msg);
      }
      const draftSource =
        res.headers.get("X-PropertyIQ-Listing-Draft") ||
        res.headers.get("x-propertyiq-listing-draft") ||
        null;
      const draft = (await res.json()) as {
        suggestedTitle?: string;
        suggestedDescription?: string;
        sellingHighlights?: string[];
        completenessScore?: number;
        draftSource?: string | null;
      };
      if (draft.suggestedTitle) setTitle(draft.suggestedTitle);
      let desc = draft.suggestedDescription || "";
      if (draft.sellingHighlights?.length) {
        desc = `${desc}\n\nHighlights:\n- ${draft.sellingHighlights.join("\n- ")}`;
      }
      if (desc) setDescription(desc.trim());
      const via = draftSource || draft.draftSource || "ai";
      setAiMessage(
        `AI draft applied via ${via}${
          draft.completenessScore != null ? ` · completeness ${draft.completenessScore}%` : ""
        }. Review and edit before publishing.`
      );
    } catch (e: unknown) {
      setAiMessage(e instanceof Error ? e.message : "Could not generate AI draft.");
    } finally {
      setDraftBusy(false);
    }
  };

  const runRentScenario = async () => {
    if (!isAuthenticated) {
      setAiMessage("Sign in as an agent to run rent scenarios.");
      return;
    }
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setAiMessage("Enter a valid asking price before running a scenario.");
      return;
    }

    setScenarioBusy(true);
    setAiMessage(null);
    try {
      const res = await authFetch("/api/ai/property-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          area: area.trim() || "Prime Location",
          propertyType: mapPropertyType(propertyType),
          size: Number(landArea) || 1,
          sizeUnit: landUnit,
          askingPrice: parsedPrice,
          bedrooms: propertyType === "Plot" ? null : Number(bedrooms) || null,
          purpose: purpose === "Rent" ? "Rent" : "Sale",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || `Scenario failed (${res.status}).`
        );
      }
      const valuationHdr =
        res.headers.get("X-PropertyIQ-Valuation") ||
        res.headers.get("x-propertyiq-valuation");
      const explainHdr =
        res.headers.get("X-PropertyIQ-Scenario-Explain") ||
        res.headers.get("x-propertyiq-scenario-explain");
      const result = (await res.json()) as {
        estimatedRentMonthlyMin: number;
        estimatedRentMonthlyMax: number;
        grossYieldPercentage: number;
        fairPriceLow: number;
        fairPriceHigh: number;
        valuationSource?: string | null;
        saleCompCount?: number;
        rentCompCount?: number;
        explainSource?: string | null;
        confidenceScore?: number;
      };
      setExpectedRentMin(result.estimatedRentMonthlyMin);
      setExpectedRentMax(result.estimatedRentMonthlyMax);
      const fmt = (n: number) =>
        n >= 10_000_000
          ? `PKR ${(n / 10_000_000).toFixed(2)} Cr`
          : n >= 100_000
            ? `PKR ${(n / 100_000).toFixed(1)} Lakh`
            : `PKR ${n.toLocaleString()}`;
      const via = valuationHdr || result.valuationSource || "formula";
      const saleN = result.saleCompCount ?? 0;
      const rentN = result.rentCompCount ?? 0;
      setScenarioSummary(
        `Rent ${fmt(result.estimatedRentMonthlyMin)}–${fmt(result.estimatedRentMonthlyMax)}/mo · Yield ${result.grossYieldPercentage.toFixed(1)}% · Fair ${fmt(result.fairPriceLow)}–${fmt(result.fairPriceHigh)} · via ${via} (${saleN} sale / ${rentN} rent comps)`
      );
      const explain = explainHdr || result.explainSource || "none";
      setAiMessage(
        `AI rent scenario ready via ${via}${explain === "ollama" ? " + ollama explain" : ""} — values will save with the listing.`
      );
    } catch (e: unknown) {
      setAiMessage(e instanceof Error ? e.message : "Could not run rent scenario.");
    } finally {
      setScenarioBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!isHydrated) return;

    if (!isAuthenticated || !user?.token) {
      setSubmitError("Please sign in as an agent before publishing a listing.");
      return;
    }

    const parsedPrice = Number(price);
    const parsedLandArea = Number(landArea);
    const parsedYear = Number(constructionYear);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setSubmitError("Enter a valid asking price in PKR.");
      return;
    }
    if (!Number.isFinite(parsedLandArea) || parsedLandArea <= 0) {
      setSubmitError("Enter a valid land area size.");
      return;
    }
    const pinLat = latitude ?? defaultCenterForCity(city).lat;
    const pinLng = longitude ?? defaultCenterForCity(city).lng;
    if (!Number.isFinite(pinLat) || !Number.isFinite(pinLng)) {
      setSubmitError("Set the property pin on the map (or enter latitude/longitude).");
      return;
    }
    const currentYear = new Date().getFullYear();
    if (
      propertyType !== "Plot" &&
      (!Number.isFinite(parsedYear) || parsedYear < 1950 || parsedYear > currentYear + 2)
    ) {
      setSubmitError(`Enter a valid built year between 1950 and ${currentYear + 2}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        purpose,
        propertyType: mapPropertyType(propertyType),
        province: provinceForCity(city),
        city,
        area: area.trim(),
        address: address.trim() || null,
        latitude: pinLat,
        longitude: pinLng,
        privacyLevel: privacyLevelFromShowPin(showPinToCustomers),
        price: parsedPrice,
        currency: "PKR",
        isNegotiable: true,
        bedrooms: propertyType === "Plot" ? null : Number(bedrooms),
        bathrooms: propertyType === "Plot" ? null : Number(bathrooms),
        landArea: parsedLandArea,
        landAreaUnit: landUnit,
        constructionYear:
          propertyType === "Plot"
            ? null
            : Number.isFinite(parsedYear)
              ? parsedYear
              : null,
        description: description.trim(),
        expectedRentMin,
        expectedRentMax,
      };

      let targetPropertyId = propertyId ?? "";

      if (isEditMode && propertyId) {
        const updateRes = await authFetch(`/api/properties/${propertyId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        if (!updateRes.ok) {
          const err = await updateRes.json().catch(() => ({}));
          throw new Error(
            (err as { message?: string }).message ||
              `Could not update listing (${updateRes.status}).`
          );
        }
      } else {
        const createRes = await authFetch("/api/properties", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          throw new Error(
            (err as { message?: string }).message ||
              `Could not create listing (${createRes.status}). Is the API running?`
          );
        }

        const created = (await createRes.json()) as { id: string; title?: string };
        targetPropertyId = created.id;
      }

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const category = mapMediaCategory(photo.category);
        const aiTags = photo.aiTags.join(", ");

        if (photo.file) {
          const formData = new FormData();
          formData.append("file", photo.file);
          formData.append("category", category);
          formData.append("sortOrder", String(i));
          formData.append("isPrimary", String(photo.isPrimary));
          formData.append("aiTags", aiTags);

          const uploadRes = await authFetch(`/api/properties/${targetPropertyId}/media/upload`, {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}));
            throw new Error(
              (err as { message?: string }).message ||
                `Listing created, but photo upload failed (${uploadRes.status}).`
            );
          }
        } else if (!isEditMode && /^https?:\/\//i.test(photo.previewUrl)) {
          const mediaRes = await authFetch(`/api/properties/${targetPropertyId}/media`, {
            method: "POST",
            body: JSON.stringify({
              url: photo.previewUrl,
              mediaType: "Photo",
              category,
              sortOrder: i,
              isPrimary: photo.isPrimary,
              aiTags,
            }),
          });

          if (!mediaRes.ok) {
            const err = await mediaRes.json().catch(() => ({}));
            throw new Error(
              (err as { message?: string }).message ||
                `Listing created, but attaching sample photo failed (${mediaRes.status}).`
            );
          }
        }
      }

      for (const doc of evidenceDocs) {
        const formData = new FormData();
        formData.append("file", doc.file);
        formData.append("documentType", doc.documentType);

        const evidenceRes = await authFetch(`/api/properties/${targetPropertyId}/evidence`, {
          method: "POST",
          body: formData,
        });

        if (!evidenceRes.ok) {
          const err = await evidenceRes.json().catch(() => ({}));
          throw new Error(
            (err as { message?: string }).message ||
              `Listing created, but evidence upload failed (${evidenceRes.status}).`
          );
        }
      }

      setCreatedPropertyId(targetPropertyId);
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to publish listing.";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryPhoto = photos.find((p) => p.isPrimary) || photos[0];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <Link
          href={isEditMode ? "/agent/properties" : "/agent"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isEditMode ? "Back to My Listings" : "Back to Dashboard"}</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
          {isEditMode ? "Edit Property Listing" : "Create New Property Listing"}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          {isEditMode
            ? "Update location, pricing, photos, and map pin visibility on your published listing."
            : "List a residential or commercial property with AI listing optimization, drag-and-drop photos, and automatic valuation scenarios."}
        </p>
        {isHydrated && isAuthenticated && (
          <p className="text-[11px] text-emerald-700 mt-1 font-medium">
            Publishing as {user?.fullName} ({user?.email})
          </p>
        )}
      </div>

      {loadingProperty ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          Loading listing for edit…
        </div>
      ) : submitted ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-xl font-bold text-emerald-950">
              {isEditMode ? "Listing Updated Successfully!" : "Property Published Successfully!"}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-800 max-w-md mx-auto">
              {isEditMode
                ? "Your changes are saved. The public listing and agent workspace will reflect the update."
                : "Your listing is saved in Postgres and linked to your agent account. It will show on your Agent Dashboard."}
            </p>
          </div>

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
                {area ? `${area}, ` : ""}
                {city} • {landArea} {landUnit}
              </p>
              <p className="text-sm font-extrabold text-emerald-700">
                {price ? `PKR ${Number(price).toLocaleString()}` : "Price on Request"}
              </p>
              {createdPropertyId && (
                <p className="text-[10px] font-mono text-slate-400 truncate">ID: {createdPropertyId}</p>
              )}
            </div>
          </div>

          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              href="/agent"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition shadow"
            >
              View on Agent Dashboard
            </Link>
            <Link
              href="/agent/verification"
              className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition shadow"
            >
              Request verification
            </Link>
            {createdPropertyId && (
              <Link
                href={`/properties/${createdPropertyId}`}
                className="bg-white border border-emerald-200 text-emerald-800 text-xs font-bold px-6 py-2.5 rounded-xl transition hover:bg-emerald-50"
              >
                Open Listing Detail
              </Link>
            )}
            {!isEditMode && (
              <button
                onClick={resetForm}
                className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-6 py-2.5 rounded-xl transition hover:bg-slate-50"
              >
                Add Another Listing
              </button>
            )}
            {isEditMode && createdPropertyId && (
              <Link
                href={`/properties/${createdPropertyId}/edit`}
                className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-6 py-2.5 rounded-xl transition hover:bg-slate-50"
              >
                Continue editing
              </Link>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {!isAuthenticated && isHydrated && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              You are not signed in.{" "}
              <Link href="/auth/login?next=/properties/new" className="font-bold underline">
                Sign in as Agent
              </Link>{" "}
              first so the listing is owned by your agent account.
            </div>
          )}

          {submitError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              {submitError}
            </div>
          )}

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

              <div className="sm:col-span-2">
                <PropertyLocationPicker
                  city={city}
                  area={area}
                  address={address}
                  latitude={latitude}
                  longitude={longitude}
                  showPinToCustomers={showPinToCustomers}
                  onLocationChange={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  onShowPinChange={setShowPinToCustomers}
                />
              </div>
            </div>
          </div>

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
                        <option key={b} value={b}>
                          {b} Beds
                        </option>
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
                        <option key={b} value={b}>
                          {b} Baths
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">Built Year</label>
                    <input
                      type="number"
                      required
                      min={1950}
                      max={new Date().getFullYear() + 2}
                      value={constructionYear}
                      onChange={(e) => setConstructionYear(e.target.value)}
                      placeholder="e.g. 2024"
                      className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-100 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-slate-900">Title & Description</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={draftBusy || scenarioBusy}
                  onClick={() => void runRentScenario()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 px-3 py-1.5 rounded-lg transition"
                >
                  {scenarioBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>AI rent scenario</span>
                </button>
                <button
                  type="button"
                  disabled={draftBusy || scenarioBusy}
                  onClick={() => void generateAiDraft()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-purple-100 hover:bg-purple-200 disabled:opacity-50 text-purple-800 px-3 py-1.5 rounded-lg transition"
                >
                  {draftBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  )}
                  <span>Auto-Draft with AI Assistant</span>
                </button>
              </div>
            </div>

            {aiMessage && (
              <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-900 font-medium">
                {aiMessage}
              </div>
            )}
            {scenarioSummary && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <span className="font-bold">Scenario: </span>
                {scenarioSummary}
                {expectedRentMin != null && expectedRentMax != null && (
                  <span className="block mt-1 text-emerald-800">
                    Will save expected rent {expectedRentMin.toLocaleString()} –{" "}
                    {expectedRentMax.toLocaleString()} PKR / month
                  </span>
                )}
              </div>
            )}

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
                  <span>Room tags from photo names</span>
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
                  const isCovered = photos.some((p) =>
                    p.category.toLowerCase().includes(room.key.toLowerCase())
                  );
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
                      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.previewUrl}
                          alt={photo.name}
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                        />

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

                        <div className="absolute bottom-2 right-2 bg-slate-900/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                          {photo.size}
                        </div>
                      </div>

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

                        {photo.classifying && (
                          <p className="text-[10px] text-violet-700 font-semibold flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            AI classifying photo…
                          </p>
                        )}

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

                        {photo.classifySource && photo.classifySource !== "pending" && (
                          <p className="text-[9px] text-slate-400">via {photo.classifySource}</p>
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

          <div className="space-y-4 border-b border-slate-100 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-700" />
                  Verification documents
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Specialists need these private title papers for due diligence. Uploading here does{" "}
                  <span className="font-semibold">not</span> auto-verify — request verification from
                  Agent → Verification. You can also upload later on that page after publish.
                </p>
              </div>
            </div>

            <ul className="grid sm:grid-cols-2 gap-2 text-xs">
              {REQUIRED_VERIFICATION_DOCS.map((doc) => (
                <li
                  key={doc.documentType + doc.label}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900">{doc.label}</span>
                    {doc.required ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                        Required
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        If applicable
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 mt-0.5">{doc.why}</p>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-700">Document type</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                >
                  {EVIDENCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                ref={evidenceInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/jpg,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setEvidenceDocs((prev) => [
                    ...prev,
                    {
                      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      file,
                      documentType: evidenceType,
                    },
                  ]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => evidenceInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition"
              >
                <Upload className="w-3.5 h-3.5" />
                Add document
              </button>
            </div>

            {evidenceDocs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-xs text-slate-500">
                No documents attached yet. You can still publish, then upload from{" "}
                <Link href="/agent/verification" className="font-bold text-emerald-700 hover:underline">
                  Agent → Verification
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-2">
                {evidenceDocs.map((doc) => {
                  const typeLabel =
                    EVIDENCE_TYPES.find((t) => t.value === doc.documentType)?.label ||
                    doc.documentType;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-blue-700 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{doc.file.name}</p>
                          <p className="text-slate-500">
                            {typeLabel} · {(doc.file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEvidenceDocs((prev) => prev.filter((d) => d.id !== doc.id))
                        }
                        className="text-rose-600 hover:text-rose-700 p-1.5"
                        aria-label="Remove evidence"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isAuthenticated}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl transition shadow-md flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isEditMode ? "Saving changes…" : "Publishing to PropertyIQ…"}</span>
              </>
            ) : (
              <>
                <span>{isEditMode ? "Save listing changes" : "Publish Listing to PropertyIQ AI"}</span>
                {photos.length > 0 && (
                  <span className="bg-emerald-700 text-emerald-100 text-xs px-2 py-0.5 rounded-full">
                    {photos.length} photo{photos.length === 1 ? "" : "s"}
                  </span>
                )}
                {evidenceDocs.length > 0 && (
                  <span className="bg-blue-800 text-blue-100 text-xs px-2 py-0.5 rounded-full">
                    {evidenceDocs.length} evidence
                  </span>
                )}
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

