"use client";

import { use } from "react";
import PropertyListingPage from "@/components/properties/PropertyListingPage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditPropertyPage({ params }: PageProps) {
  const { id } = use(params);
  return <PropertyListingPage propertyId={id} />;
}
