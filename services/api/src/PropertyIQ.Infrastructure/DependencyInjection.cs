using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Infrastructure.Auth;
using PropertyIQ.Infrastructure.Data;
using PropertyIQ.Infrastructure.Storage;

namespace PropertyIQ.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? "Host=localhost;Port=5432;Database=propertyiq_db;Username=postgres;Password=postgres";

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
            }));

        services.AddScoped<IApplicationDbContext>(provider => 
            provider.GetRequiredService<ApplicationDbContext>());

        // Auth
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();

        var secret = configuration["Jwt:Secret"] ?? "PropertyIQ_Super_Secret_Key_For_Pakistan_RealEstate_Platform_2026";
        var issuer = configuration["Jwt:Issuer"] ?? "PropertyIQ.Api";
        var audience = configuration["Jwt:Audience"] ?? "PropertyIQ.Client";

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.RequireHttpsMetadata = false;
            options.SaveToken = true;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                ValidateIssuer = true,
                ValidIssuer = issuer,
                ValidateAudience = true,
                ValidAudience = audience,
                ClockSkew = TimeSpan.Zero
            };
        });

        // Storage
        services.AddScoped<IFileStorageService, LocalFileStorageService>();

        // AI Microservice Client (Phase 5: long timeout for local Ollama NL parse)
        services.AddHttpClient<IAiServiceClient, PropertyIQ.Infrastructure.Services.AiServiceClient>((sp, client) =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var seconds = 150;
            if (int.TryParse(config["AiService:TimeoutSeconds"], out var configured) && configured > 0)
                seconds = configured;
            client.Timeout = TimeSpan.FromSeconds(seconds);
        });

        // Installment Schedule Calculator
        services.AddSingleton<PropertyIQ.Application.Services.IInstallmentScheduleCalculator, PropertyIQ.Application.Services.InstallmentScheduleCalculator>();

        // Demand & Neighborhood Intelligence Service (+ live POI enrichment)
        services.AddHttpClient("neighborhood-poi", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(40);
            client.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "application/json");
        });
        services.AddScoped<INeighborhoodPoiProvider, PropertyIQ.Infrastructure.Services.NeighborhoodPoiProvider>();
        services.AddScoped<PropertyIQ.Application.Services.IIntelligenceService, PropertyIQ.Application.Services.IntelligenceService>();

        // Phase B — live inventory comps for rent/valuation scenarios
        services.AddScoped<PropertyIQ.Application.Services.IPropertyCompsService, PropertyIQ.Application.Services.PropertyCompsService>();

        return services;
    }
}
