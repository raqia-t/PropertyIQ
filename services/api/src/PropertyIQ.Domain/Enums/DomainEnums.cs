namespace PropertyIQ.Domain.Enums;

public enum UserRole
{
    Customer = 1,
    PropertyOwner = 2,
    Agent = 3,
    Developer = 4,
    Specialist = 5,
    Moderator = 6,
    Finance = 7,
    SuperAdmin = 8
}

public enum OrganizationType
{
    Agency = 1,
    DeveloperFirm = 2,
    VerificationAgency = 3
}

public enum PropertyPurpose
{
    Sale = 1,
    Rent = 2
}

public enum PropertyType
{
    House = 1,
    ApartmentFlat = 2,
    Plot = 3,
    CommercialShop = 4,
    Office = 5,
    Warehouse = 6,
    Farmhouse = 7,
    AgriculturalLand = 8,
    Building = 9,
    RoomPortion = 10,
    Other = 99
}

public enum LandAreaUnit
{
    Marla = 1,
    Kanal = 2,
    SqYards = 3,
    SqFt = 4,
    Acres = 5
}

public enum FurnishingStatus
{
    Unfurnished = 1,
    SemiFurnished = 2,
    FullyFurnished = 3
}

public enum ListingStatus
{
    Draft = 1,
    PendingModeration = 2,
    Published = 3,
    Rejected = 4,
    Archived = 5
}

public enum LocationPrivacyLevel
{
    Exact = 1,
    ApproximateArea = 2
}

public enum InventoryStatus
{
    Available = 1,
    Reserved = 2,
    Booked = 3,
    Sold = 4,
    Blocked = 5,
    OnHold = 6,
    Cancelled = 7,
    Transferred = 8
}

public enum PaymentFrequency
{
    Monthly = 1,
    Quarterly = 2,
    Biannual = 3,
    MilestoneBased = 4
}

public enum InstallmentStatus
{
    Scheduled = 1,
    Due = 2,
    PartiallyPaid = 3,
    Paid = 4,
    Overdue = 5,
    Waived = 6,
    Cancelled = 7
}

public enum BookingStatus
{
    Pending = 1,
    Confirmed = 2,
    Cancelled = 3,
    Completed = 4
}

public enum VerificationLevel
{
    BasicDocumentReview = 1,
    PropertySiteVisit = 2,
    RecordCheck = 3,
    EnhancedDueDiligence = 4,
    LegalReview = 5
}

public enum VerificationCaseStatus
{
    Requested = 1,
    Assigned = 2,
    InProgress = 3,
    ReviewPending = 4,
    Completed = 5,
    Cancelled = 6
}

public enum ChecklistResult
{
    NotChecked = 0,
    Pass = 1,
    NeedsEvidence = 2,
    Concern = 3
}

public enum PropertyVerificationStatus
{
    Unverified = 0,
    InReview = 1,
    Verified = 2
}

public enum AgentClientSide
{
    Buyer = 1,
    Seller = 2,
    Investor = 3,
    Both = 4
}

public enum AgentClientStatus
{
    Prospect = 1,
    Active = 2,
    MandateSigned = 3,
    UnderOffer = 4,
    Closed = 5,
    Inactive = 6
}

public enum AgentVisitStatus
{
    Requested = 1,
    Confirmed = 2,
    Completed = 3,
    NoShow = 4,
    Cancelled = 5
}

public enum PropertyEvidenceDocumentType
{
    SaleFard = 1,
    Registry = 2,
    PropertyFile = 3,
    AllotmentLetter = 4,
    TransferLetter = 5,
    Other = 99
}

public enum PropertyEvidenceDocumentStatus
{
    Submitted = 1,
    Accepted = 2,
    Rejected = 3,
    Superseded = 4
}

public enum AgencyMandateStatus
{
    Active = 1,
    Suspended = 2,
    Ended = 3
}
