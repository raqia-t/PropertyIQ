"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Upload, Sparkles, Building, MapPin } from "lucide-react";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

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
          List a residential or commercial property with AI listing optimization and automatic valuation scenarios.
        </p>
      </div>

      {submitted ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
          <h2 className="text-xl font-bold text-emerald-950">Property Published Successfully!</h2>
          <p className="text-xs sm:text-sm text-emerald-800 max-w-md mx-auto">
            Your listing is live on PropertyIQ AI Pakistan. The AI Property Intelligence engine has automatically calculated market valuation and rent estimates.
          </p>
          <div className="pt-2 flex justify-center gap-4">
            <Link
              href="/search"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition"
            >
              View in Search Results
            </Link>
            <button
              onClick={() => setSubmitted(false)}
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

          {/* Section: Media Upload Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Property Photos & Media</h3>
              <span className="text-xs text-purple-700 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Photo Classifier Active</span>
              </span>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2 hover:border-emerald-500 transition cursor-pointer">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-800">Drag & Drop Photos Here or Browse</p>
              <p className="text-[11px] text-slate-400">
                Recommended: Minimum 5 photos (Front elevation, living room, kitchen, master bed, and washroom)
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3.5 rounded-xl transition shadow-md"
          >
            Publish Listing to PropertyIQ AI
          </button>
        </form>
      )}
    </div>
  );
}
