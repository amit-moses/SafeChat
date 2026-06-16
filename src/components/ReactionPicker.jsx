const EMOJIS = ['❤️','😂','😮','😢','👍','🔥']

export default function ReactionPicker({ onPick, onClose }) {
  return (
    <div onClick={e => e.stopPropagation()}
      style={{ position:'absolute', bottom:'calc(100% + 6px)', left:0, background:'white', borderRadius:999, padding:'6px 10px', boxShadow:'0 4px 16px rgba(0,0,0,.15)', display:'flex', gap:4, zIndex:100, border:'1px solid #f3f4f6' }}>
      {EMOJIS.map(e => (
        <button key={e}
          onClick={() => { onPick(e); onClose() }}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', padding:'2px 4px', borderRadius:6, transition:'transform .1s' }}
          onMouseEnter={ev => ev.target.style.transform='scale(1.3)'}
          onMouseLeave={ev => ev.target.style.transform='scale(1)'}
        >{e}</button>
      ))}
    </div>
  )
}
