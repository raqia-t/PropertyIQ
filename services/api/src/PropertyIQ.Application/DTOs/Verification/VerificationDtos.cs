using System;
using System.Collections.Generic;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Application.DTOs.Verification;

public class CreateVerificationCaseDto
{
    public Guid? PropertyId { get; set; }
    public Guid? ProjectId { get; set; }
    public VerificationLevel ServiceLevel { get; set; } = VerificationLevel.BasicDocumentReview;
    public string? CustomerNotes { get; set; }
    public List<InitialDocumentDto> Documents { get; set; } = new();
}

public class InitialDocumentDto
{
    public string DocumentType { get; set; } = "RegistryOrDeed"; // RegistryOrDeed, FardMalkiat, CnicFrontBack, AllotmentLetter, TaxChallan
    public string FileUrl { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
}

public class AssignSpecialistDto
{
    public Guid SpecialistId { get; set; }
    public string? AssignmentNotes { get; set; }
}

public class UpdateChecklistItemDto
{
    public ChecklistResult Result { get; set; }
    public string? Notes { get; set; }
}

public class AddEvidenceDto
{
    public string EvidenceType { get; set; } = "SitePhoto"; // SitePhoto, OfficialRecordDoc, SellerDoc, GPSObservation
    public string FileUrl { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? Notes { get; set; }
}

public class GenerateReportDto
{
    public string Summary { get; set; } = string.Empty;
    public string? SpecialistNotes { get; set; }
    public string? CustomerRecommendations { get; set; }
    public string? Limitations { get; set; }
}
