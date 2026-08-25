import { useNavigate, useOutletContext } from 'react-router-dom';
import { Button, Spin } from '@douyinfe/semi-ui';
import { Crown, Zap } from 'lucide-react';
import { useMemberAuth } from '../../hooks/useMemberAuth';
import { useMemberLevels } from '../../hooks/queries';
import type { PublicOutletContext } from '../../layouts/PublicLayout';

/** 等级卡片配色：按等级序号循环取用（与真实等级数量解耦） */
const LEVEL_PALETTE = [
  { color: '#6b7280', bg: '#f3f4f6' },
  { color: '#64748b', bg: '#e2e8f0' },
  { color: '#d97706', bg: '#fef3c7' },
  { color: '#7c3aed', bg: '#ede9fe' },
  { color: '#0891b2', bg: '#cffafe' },
  { color: '#e11d48', bg: '#ffe4e6' },
];

/** 折扣百分比 → 文案（100=无折扣，88=8.8 折） */
function discountText(discount: number): string {
  if (discount >= 100) return '无消费折扣';
  return `${(discount / 10).toFixed(discount % 10 === 0 ? 0 : 1)} 折消费优惠`;
}

export default function LevelsPage() {
  const navigate = useNavigate();
  const { member } = useMemberAuth();
  const { openRegister } = useOutletContext<PublicOutletContext>();
  const levelsQuery = useMemberLevels();
  const levels = levelsQuery.data ?? [];

  return (
    <>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', padding: '72px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#fff' }}>
            <Crown size={32} />
          </div>
          <h1 style={{ color: '#fff', fontSize: 36, fontWeight: 700, margin: '0 0 12px' }}>等级体系</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, margin: 0 }}>
            持续成长，专属权益随等级提升不断解锁
          </p>
        </div>
      </section>

      {/* Levels（真实等级数据，与会员中心「等级权益」同源） */}
      <section className="mc-features-section">
        <div className="mc-section-container">
          <div className="mc-section-header">
            <h2 className="mc-section-title">会员等级一览</h2>
            <p className="mc-section-sub">成长值自动升级，权益永久有效</p>
          </div>
          {levelsQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
          ) : (
            <div className="auto-grid" style={{ ['--auto-grid-min' as string]: '220px', ['--auto-grid-cols' as string]: Math.min(levels.length || 1, 4), ['--auto-grid-gap' as string]: '20px' }}>
              {levels.map((level, index) => {
                const palette = LEVEL_PALETTE[index % LEVEL_PALETTE.length];
                return (
                  <div key={level.id} style={{ border: `2px solid ${palette.color}40`, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ background: palette.bg, padding: '24px 20px', textAlign: 'center' }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: palette.color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <Crown size={24} color="#fff" />
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: palette.color }}>{level.name}</div>
                      {level.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{level.description}</div>}
                    </div>
                    <div style={{ padding: '12px 20px', background: '#fff', borderBottom: `1px solid ${palette.color}20`, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
                      {level.growthThreshold > 0 ? `成长值满 ${level.growthThreshold.toLocaleString()}` : '注册即得'}
                    </div>
                    <div style={{ padding: '16px 20px', background: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13, color: 'var(--m-text)' }}>
                        <Zap size={12} color={palette.color} style={{ flexShrink: 0 }} />
                        {discountText(level.discount)}
                      </div>
                      {level.benefits.map((perk) => (
                        <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13, color: 'var(--m-text)' }}>
                          <Zap size={12} color={palette.color} style={{ flexShrink: 0 }} />
                          {perk}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      {!member && (
        <section className="mc-cta-section">
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 12px' }}>从普通会员开始，开启升级之路</h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: '0 0 28px' }}>注册即可成为普通会员，消费即可自动升级</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button size="large" theme="solid" onClick={openRegister}
                style={{ background: '#fff', color: 'var(--m-primary)', fontWeight: 600 }}>
                立即注册
              </Button>
              <Button size="large" theme="borderless" onClick={() => navigate('/features')}
                style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }}>
                查看全部特权
              </Button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
