// Adds UTM parameters to an outbound social URL. Do not use this for
// sportsbook, courier, or affiliate links. Those links are not allowed.
export function withSocialUtm(url, source, campaign = "draw-buddy-organic") {
    const parsed = new URL(url);
    parsed.searchParams.set("utm_source", source);
    parsed.searchParams.set("utm_medium", "social");
    parsed.searchParams.set("utm_campaign", campaign);
    return parsed.toString();
}
