namespace CommonService.Entities;

public class Location
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public Guid? ParentLocationId { get; set; }

    /// <summary>Ulb | Zone | Ward. (Historically also State/District — legacy rows keep those.)</summary>
    public string LocationType { get; set; } = string.Empty;

    /// <summary>
    /// Only meaningful when LocationType == "Ulb": NagarNigam | NagarPalikaParishad | NagarPanchayat.
    /// This is a classification of the body, not a place, which is why it is a column here rather
    /// than its own level in the tree — "Nagar Nigam" must never be selectable as a location.
    /// </summary>
    public string? UlbType { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
