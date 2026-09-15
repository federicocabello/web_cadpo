export const formatInstagramHandle = value => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  const withoutAt = rawValue.replace(/^@+/, '').trim();
  const urlMatch = withoutAt.match(
    /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#]+)/i
  );
  const candidate = urlMatch ? urlMatch[1] : withoutAt;
  const username = candidate
    .replace(/^@+/, '')
    .split(/[/?#]/)[0]
    .trim();

  return username ? `@${username}` : '';
};

export const getInstagramUrl = value => {
  const handle = formatInstagramHandle(value);
  return handle ? `https://www.instagram.com/${handle.slice(1)}/` : '';
};
