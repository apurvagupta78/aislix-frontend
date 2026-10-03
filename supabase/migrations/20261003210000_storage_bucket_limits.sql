-- Size and type limits on every private bucket. HTML and SVG are never accepted,
-- so stored files cannot run script when opened from a signed URL.

update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array[
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf', 'text/csv',
      'video/mp4', 'video/quicktime', 'video/webm',
      'application/octet-stream'
    ]
where id = 'scan-images';

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
where id in ('avatars', 'org-logos');

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['application/json', 'text/csv', 'text/plain', 'application/octet-stream']
where id = 'catalog-data';
