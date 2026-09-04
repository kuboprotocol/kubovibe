UPDATE public.projects
SET is_published = true,
    published_url = 'https://kubovibe.dev/app/2f03bb97-76ef-4787-beed-f46540bc54d7/cyber-segurit-infi',
    published_at = COALESCE(published_at, now()),
    updated_at = now()
WHERE id = '2f03bb97-76ef-4787-beed-f46540bc54d7';