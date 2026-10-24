using System.IO;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi;
using PropertyIQ.Api.Services;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Infrastructure;
using PropertyIQ.Infrastructure.Data;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// Add Infrastructure
builder.Services.AddInfrastructure(builder.Configuration);

// CORS for Web and Mobile
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAllOrigins", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:19006", "http://localhost:8081")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Swagger with JWT Security Scheme
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "PropertyIQ AI Pakistan API",
        Version = "v1",
        Description = "Master API for PropertyIQ AI Pakistan - Real Estate Discovery, Project Inventory, and Property Verification"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer"),
            new List<string>()
        }
    });
});

var app = builder.Build();

// Seed Database
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        await DbInitializer.SeedAsync(context);
        Log.Information("Database initialization and seed completed.");
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Database connection not available for seeding at startup; running in offline/mock mode.");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "PropertyIQ AI API v1");
    });
}

app.UseCors("AllowAllOrigins");

var storagePath = Path.GetFullPath(
    builder.Configuration["Storage:LocalPath"]
    ?? Path.Combine(Directory.GetCurrentDirectory(), "storage_data"));
Directory.CreateDirectory(storagePath);
Directory.CreateDirectory(Path.Combine(storagePath, "public"));
Directory.CreateDirectory(Path.Combine(storagePath, "private"));
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(storagePath),
    RequestPath = "/media-files",
    OnPrepareResponse = ctx =>
    {
        // Never expose private evidence via static file middleware
        var path = ctx.Context.Request.Path.Value ?? "";
        if (path.Contains("/private/", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.StatusCode = StatusCodes.Status404NotFound;
            ctx.Context.Response.ContentLength = 0;
            ctx.Context.Response.Body = Stream.Null;
        }
    }
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/", () => new
{
    Platform = "PropertyIQ AI Pakistan",
    Status = "Online",
    Environment = app.Environment.EnvironmentName,
    Version = "1.0.0",
    TimestampUtc = DateTime.UtcNow
});

app.Run();
