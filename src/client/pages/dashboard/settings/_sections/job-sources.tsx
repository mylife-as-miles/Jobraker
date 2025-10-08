import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../../../lib/supabaseClient';
import { Switch } from '../../../../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';

export const JobSourceSettings = () => {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [includeLinkedIn, setIncludeLinkedIn] = useState(true);
  const [includeIndeed, setIncludeIndeed] = useState(true);
  const [includeSearch, setIncludeSearch] = useState(true);
  const [firecrawlApiKey, setFirecrawlApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [enabledSources, setEnabledSources] = useState<string[]>(['deepresearch','remotive','remoteok','arbeitnow']);
  const [allowedDomains, setAllowedDomains] = useState<string>('');
  const allSources = useMemo(() => [
    { id: 'deepresearch', label: 'Deep Research (Firecrawl)' },
    { id: 'remotive', label: 'Remotive' },
    { id: 'remoteok', label: 'RemoteOK' },
    { id: 'arbeitnow', label: 'Arbeitnow' },
  ], []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: userData } = await (supabase as any).auth.getUser();
        const uid = (userData as any)?.user?.id;
        if (!uid) { setLoading(false); return; }
        const { data } = await (supabase as any)
          .from('job_source_settings')
          .select('include_linkedin, include_indeed, include_search, enabled_sources, allowed_domains, firecrawl_api_key')
          .eq('id', uid)
          .maybeSingle();
        if (data) {
          setIncludeLinkedIn(Boolean(data.include_linkedin));
          setIncludeIndeed(Boolean(data.include_indeed));
          setIncludeSearch(Boolean(data.include_search));
          if (data.firecrawl_api_key) setFirecrawlApiKey(data.firecrawl_api_key);
          if (Array.isArray(data.enabled_sources)) setEnabledSources(data.enabled_sources);
          if (Array.isArray(data.allowed_domains)) setAllowedDomains(data.allowed_domains.join(','));
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: userData } = await (supabase as any).auth.getUser();
      const uid = (userData as any)?.user?.id;
      if (!uid) return;
    await (supabase as any)
        .from('job_source_settings')
        .upsert({
          id: uid,
          include_linkedin: includeLinkedIn,
          include_indeed: includeIndeed,
          include_search: includeSearch,
          firecrawl_api_key: firecrawlApiKey,
      enabled_sources: enabledSources,
      allowed_domains: allowedDomains.split(',').map(s => s.trim()).filter(Boolean),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
    } catch {}
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Sources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Control where live job search pulls from.</p>

        <div className="flex items-center justify-between py-2">
          <span>Include LinkedIn</span>
          <Switch checked={includeLinkedIn} onCheckedChange={setIncludeLinkedIn} disabled={loading} />
        </div>
        <div className="flex items-center justify-between py-2">
          <span>Include Indeed</span>
          <Switch checked={includeIndeed} onCheckedChange={setIncludeIndeed} disabled={loading} />
        </div>
        <div className="flex items-center justify-between py-2">
          <span>Include Search/Listing Pages</span>
          <Switch checked={includeSearch} onCheckedChange={setIncludeSearch} disabled={loading} />
        </div>

        <div className="py-2 space-y-2">
          <div className="font-medium">Enabled Sources</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allSources.map(s => (
              <label key={s.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[hsl(var(--ring))]"
                  checked={enabledSources.includes(s.id)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEnabledSources(prev => checked ? Array.from(new Set([...prev, s.id])) : prev.filter(x => x !== s.id));
                  }}
                  disabled={loading}
                />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="py-2 space-y-1">
          <div className="font-medium">Allowed Domains</div>
          <p className="text-sm text-muted-foreground">Comma-separated list to prefer/limit when scraping (e.g., careers.google.com, amazon.jobs)</p>
          <input className="w-full rounded-xl border border-input bg-background p-2 text-foreground placeholder:text-foreground/60" value={allowedDomains} onChange={(e) => setAllowedDomains(e.target.value)} placeholder="example.com, jobs.example.org" />
        </div>

        <div className="py-2 space-y-1">
          <div className="font-medium">Firecrawl API Key</div>
          <p className="text-sm text-muted-foreground">Required for Deep Research. Get yours at <a href="https://firecrawl.dev" target="_blank" rel="noopener noreferrer" className="underline">firecrawl.dev</a>.</p>
          <input
            type="password"
            className="w-full rounded-xl border border-input bg-background p-2 text-foreground placeholder:text-foreground/60"
            value={firecrawlApiKey}
            onChange={(e) => setFirecrawlApiKey(e.target.value)}
            placeholder="Enter your Firecrawl API key"
          />
        </div>

        <Button variant="primary" onClick={save} disabled={saving || loading}>Save</Button>
      </CardContent>
    </Card>
  );
};
