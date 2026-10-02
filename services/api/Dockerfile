FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY services/api/PropertyIQ.slnx services/api/
COPY services/api/src/PropertyIQ.Domain/PropertyIQ.Domain.csproj services/api/src/PropertyIQ.Domain/
COPY services/api/src/PropertyIQ.Application/PropertyIQ.Application.csproj services/api/src/PropertyIQ.Application/
COPY services/api/src/PropertyIQ.Infrastructure/PropertyIQ.Infrastructure.csproj services/api/src/PropertyIQ.Infrastructure/
COPY services/api/src/PropertyIQ.Api/PropertyIQ.Api.csproj services/api/src/PropertyIQ.Api/
COPY services/api/tests/PropertyIQ.UnitTests/PropertyIQ.UnitTests.csproj services/api/tests/PropertyIQ.UnitTests/

RUN dotnet restore services/api/PropertyIQ.slnx

COPY services/api/ services/api/
WORKDIR /src/services/api/src/PropertyIQ.Api
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5000
EXPOSE 5000

ENTRYPOINT ["dotnet", "PropertyIQ.Api.dll"]
