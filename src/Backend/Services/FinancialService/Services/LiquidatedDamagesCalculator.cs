using System;

namespace FinancialService.Services;

/// <summary>
/// Mirrors the formula that has lived only in GlobalProjects.tsx (Admin's project list):
/// 0.5% of contract value per week a work order runs past its end date, capped at 10%.
/// There it was purely a display number — nothing ever subtracted it from a payment. This
/// is the same math run server-side so a bill submitted against an overdue work order can
/// carry it as a real deduction instead of a number nobody acted on.
/// </summary>
public static class LiquidatedDamagesCalculator
{
    private const decimal WeeklyRate = 0.005m;
    private const decimal Cap = 0.10m;

    public readonly record struct Result(decimal Amount, int WeeksLate);

    public static Result Compute(decimal contractValue, DateTime? endDate, string? workOrderStatus)
    {
        if (endDate is null || string.Equals(workOrderStatus, "Completed", StringComparison.OrdinalIgnoreCase))
            return new Result(0, 0);

        var end = endDate.Value;
        if (end >= DateTime.UtcNow) return new Result(0, 0);

        var weeksLate = (int)Math.Floor((DateTime.UtcNow - end).TotalDays / 7);
        if (weeksLate < 1) return new Result(0, 0);

        var amount = Math.Min(contractValue * WeeklyRate * weeksLate, contractValue * Cap);
        return new Result(amount, weeksLate);
    }
}
