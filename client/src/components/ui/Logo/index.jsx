import { Link } from 'react-router-dom';
import nctLogoIcon from '../../../assets/nct-logo-icon.png';

// DESIGN.md Open Decision #3: the references used two different marks (a waveform tile on
// auth pages, an "SA" lettermark on the dashboard header). Standardized on one: the real NCT
// (Neo Culture Tech) club mark, everywhere.
const SIZES = {
  sm: { tile: 'h-8 w-8', text: 'text-base' },
  md: { tile: 'h-10 w-10', text: 'text-xl' },
  lg: { tile: 'h-14 w-14', text: 'text-2xl' },
};

export function Logo({ size = 'md', withWordmark = true, to = '/', className = '' }) {
  const s = SIZES[size];
  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className={`flex ${s.tile} shrink-0 items-center justify-center`}>
        <img src={nctLogoIcon} alt="NCT" className="h-full w-full object-contain" />
      </span>
      {withWordmark && (
        <span className={`font-semibold tracking-tight text-on-surface ${s.text}`}>
          NCT<span className="text-primary"> Meeting Summarizer</span>
        </span>
      )}
    </span>
  );

  return to ? (
    <Link to={to} className="inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg">
      {content}
    </Link>
  ) : (
    content
  );
}

export default Logo;
