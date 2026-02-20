import { memo } from 'react';

export const REACTION_EMOJIS = [
  '\u2764\uFE0F','😂','🙏','🔥','👍','😢','👏','😍','🤯','🚀','🎉','🤔','✅','💯','👀','🤡','💩','☕',
];

const ReactionPicker = memo(function ReactionPicker({ onSelect, className = '' }) {
  return (
    <div className={`react-picker ${className}`}>
      {REACTION_EMOJIS.map((emoji) => (
        <button key={emoji} className="react-picker-emoji" onClick={() => onSelect(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
});

export default ReactionPicker;
