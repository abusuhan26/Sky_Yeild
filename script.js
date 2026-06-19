// ═══════════════════════════════════════════════════
//  SKYYIELD — script.js  (Glassmorphism Edition)
//  Requires: database.js loaded first
// ═══════════════════════════════════════════════════

// ── State ────────────────────────────────────────
let selectedMutation   = null;
let debounceTimer      = null;
let favourites         = new Set();
let currentBest        = null;
let currentSort        = 'alpha-az';
let bazaarPrices       = {};
let bazaarStatus       = 'idle';

// Compare selections
let compareSelA = null;
let compareSelB = null;

const TIER_ORDER = ["COMMON","UNCOMMON","RARE","EPIC","LEGENDARY"];

// ── Crop-specific colours (user palette) ─────────────
const CROP_COLORS = {
    "Wheat":          "#FFD700",
    "Carrot":         "#FF8C00",
    "Nether Wart":    "#B22222",
    "Sugar Cane":     "#00FF00",
    "Cocoa Beans":    "#4A2711",
    "Cactus":         "#005A32",
    "Potato":         "#D2B48C",
    "Pumpkin":        "#FF6B6B",
    "Melon Slice":    "#FF007F",
    "Brown Mushroom": "#8A2BE2",
    "Red Mushroom":   "#9932CC",
    "Sunflower":      "#FFFF00",
    "Moonflower":     "#00FFFF",
    "Wild Rose":      "#FF0000"
};
const PIE_FALLBACK_COLORS = ['#4ade80','#60a5fa','#c084fc','#fb923c','#f43f5e','#34d399'];
function getCropColor(name, idx) {
    return CROP_COLORS[name] || PIE_FALLBACK_COLORS[idx % PIE_FALLBACK_COLORS.length];
}
function darkenColor(hex, factor) {
    // factor: 0=black, 1=same colour
    const r = parseInt(hex.slice(1,3),16)||0;
    const g = parseInt(hex.slice(3,5),16)||0;
    const b = parseInt(hex.slice(5,7),16)||0;
    return `rgb(${Math.round(r*factor)},${Math.round(g*factor)},${Math.round(b*factor)})`;
}
function lightenColor(hex, factor) {
    // factor: 1=same, >1=toward white
    let r = parseInt(hex.slice(1,3),16)||0;
    let g = parseInt(hex.slice(3,5),16)||0;
    let b = parseInt(hex.slice(5,7),16)||0;
    r = Math.min(255, Math.round(r + (255-r)*(factor-1)));
    g = Math.min(255, Math.round(g + (255-g)*(factor-1)));
    b = Math.min(255, Math.round(b + (255-b)*(factor-1)));
    return `rgb(${r},${g},${b})`;
}

// ── Highcharts chart instances ────────────────────
let pieChartInstance    = null;
let columnChartInstance = null;

// Load persisted prefs
try {
    const saved = localStorage.getItem('skyYieldFavs');
    if (saved) favourites = new Set(JSON.parse(saved));
} catch(e){}
try {
    const savedSort = localStorage.getItem('skyYieldSort');
    if (savedSort) currentSort = savedSort;
} catch(e){}

// ── All names (alpha base) ────────────────────────
const ALL_NAMES = Object.keys(mutationDatabase).sort();

function getSortedNames() {
    switch (currentSort) {
        case 'alpha-za':
            return [...ALL_NAMES].sort((a,b) => b.localeCompare(a));
        case 'tier-asc':
            return TIER_ORDER.flatMap(t => ALL_NAMES.filter(n => mutationDatabase[n].rarity === t));
        case 'tier-desc':
            return [...TIER_ORDER].reverse().flatMap(t => ALL_NAMES.filter(n => mutationDatabase[n].rarity === t));
        default: // alpha-az
            return ALL_NAMES;
    }
}

// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    selectedMutation = ALL_NAMES[0];
    compareSelA = ALL_NAMES[0];
    compareSelB = ALL_NAMES[1] || ALL_NAMES[0];

    setupThemeToggle();
    setupSortToggle();
    renderGrid(getSortedNames());
    buildCompareDropdowns();
    setupInputListeners();
    setupNumberInputQoL();
    setupTabs();
    setupSearch();
    setupToolsMenu();
    setupPlantedAt();
    setupExport();
    setupBazaar();
    calculate();
});

// ═══════════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════════
function fmt(n)  { return Math.round(n).toLocaleString(); }
function fmtTime(s) {
    if (s === 0) return 'Instant';
    const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=Math.floor(s%60);
    if(h>0) return `${h}h ${m}m ${sec}s`;
    if(m>0) return `${m}m ${sec}s`;
    return `${sec}s`;
}
function fmtCoins(n) {
    if(n===Infinity||isNaN(n)) return '∞';
    if(n>=1_000_000) return (n/1_000_000).toFixed(2)+'M';
    if(n>=1_000)     return (n/1_000).toFixed(1)+'K';
    return fmt(n);
}
function hexToRgba(hex,alpha) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
}
function calcGrowthTimePerStage(c,g,u) {
    const u_val = u===9 ? 0.50 : 0.05*u;
    return 14400 / (1 + 0.025*c + 0.0025*g + u_val);
}
function getInputs() {
    const n  = id => parseFloat(document.getElementById(id).value) || 0;
    const cl = (v,a,b) => Math.min(Math.max(v,a),b);
    return {
        unique:     n('uniqueYield'),
        plant:      n('plantYield'),
        effect:     n('effectYield'),
        chip:       n('chipYield'),
        fortune:    n('fortune'),
        mutPerPlot: Math.max(n('mutationsPerPlot'),1),
        plots:      cl(n('plotNumber'),1,3),
        c:          cl(n('uniqueCrops'),0,12),
        g:          n('cropGrowth'),
        u:          cl(n('ghUpgrade'),0,9),
    };
}
function calcMutationStats(mutName, inp) {
    const data = mutationDatabase[mutName];
    const {unique,plant,effect,chip,fortune,mutPerPlot,plots,c,g,u} = inp;
    const multiplier  = (1+(unique+plant+effect)/100) * (1+chip/100) * (1+fortune/100);
    const totalPlants = mutPerPlot * plots;
    let totalCoins = 0;
    const cropResults = [];
    for (const [cropName,baseAmt] of Object.entries(data.drops)) {
        const finalYield = Math.round(multiplier * baseAmt * totalPlants);
        const price      = npcPrices[cropName] ?? 0;
        const coins      = finalYield * price;
        totalCoins += coins;
        cropResults.push({cropName,finalYield,price,coins});
    }
    const stages = data.stages;
    let totalGrowthSeconds=0, coinsPerHour=null;
    if (stages>0) {
        totalGrowthSeconds = calcGrowthTimePerStage(c,g,u)*stages;
        coinsPerHour       = totalCoins/(totalGrowthSeconds/3600);
    } else {
        coinsPerHour = Infinity;
    }
    const coinsPerStage = stages>0 ? totalCoins/stages : totalCoins;
    return {totalCoins,coinsPerHour,coinsPerStage,totalGrowthSeconds,cropResults,stages};
}

// ── Number input QoL: select-all on focus so typing replaces 0 ──
function setupNumberInputQoL() {
    document.querySelectorAll('input[type="number"]').forEach(inp => {
        inp.addEventListener('focus', () => {
            inp.select();
        });
        inp.addEventListener('mouseup', (e) => {
            e.preventDefault(); // keep selection after mouse release
        });
    });
}

// ═══════════════════════════════════════════════════
//  RENDER GRID
// ═══════════════════════════════════════════════════
function renderGrid(names) {
    const container = document.getElementById('mutationGrid');
    container.innerHTML = '';
    names.forEach(name => {
        const data  = mutationDatabase[name];
        const color = RARITY_COLORS[data.rarity];
        const glow  = hexToRgba(color,0.3);
        const item  = document.createElement('div');
        item.className = 'mutation-item';
        item.dataset.name = name;
        item.style.setProperty('--rarity-color', color);
        item.style.setProperty('--rarity-glow',  glow);
        item.style.borderColor = hexToRgba(color,0.3);
        if (name===selectedMutation) item.classList.add('selected');
        const img = document.createElement('img');
        img.src=data.image; img.alt=name;
        img.onerror=()=>{ img.style.display='none'; };
        item.appendChild(img);
        const star = document.createElement('button');
        star.className = 'fav-btn'+(favourites.has(name)?' active':'');
        star.textContent='★'; star.title='Toggle favourite';
        star.addEventListener('click',e=>{e.stopPropagation();toggleFavourite(name,star);});
        item.appendChild(star);
        item.addEventListener('mouseenter',e=>showTooltip(e,name));
        item.addEventListener('mousemove', e=>moveTooltip(e));
        item.addEventListener('mouseleave',hideTooltip);
        item.addEventListener('click',()=>{
            document.querySelectorAll('.mutation-item').forEach(el=>el.classList.remove('selected'));
            item.classList.add('selected');
            selectedMutation=name;
            calculate();
        });
        container.appendChild(item);
    });
    updateBestBadge();
}

// ═══════════════════════════════════════════════════
//  TOOLTIP
// ═══════════════════════════════════════════════════
const tooltip = document.getElementById('tooltip');
function showTooltip(e,name) {
    const data  = mutationDatabase[name];
    const color = RARITY_COLORS[data.rarity];
    const drops = data.drops;

    const stageText = data.stages === 0
        ? '⚡ Instant Harvest'
        : `🌿 ${data.stages} Stage${data.stages>1?'s':''}`;

    const waterClass = data.requiresWater ? 'tt-water-yes' : 'tt-water-no';
    const waterText  = data.requiresWater ? '💧 Needs Water' : '🌱 No Water';

    let dropsHTML = '';
    if (Object.keys(drops).length === 0) {
        dropsHTML = `<span class="tt-drop" style="color:var(--text-muted);font-style:italic">No drops</span>`;
    } else {
        dropsHTML = `<span class="tt-drops-label">Base Drops</span>` +
            Object.entries(drops).map(([c,a]) => {
                const cropColor = CROP_COLORS[c] || 'var(--text)';
                return `<span class="tt-drop"><span style="color:#fff;font-weight:700">${a}×</span> <span style="color:${cropColor};font-weight:600">${c}</span></span>`;
            }).join('');
    }

    tooltip.innerHTML=`
        <span class="tt-name" style="color:${color}">${name}</span>
        <span class="tt-meta">
            <span class="tt-meta-row tt-rarity" style="color:${color}">${data.rarity}</span>
            <span class="tt-meta-row tt-stages">${stageText}</span>
            <span class="tt-meta-row ${waterClass}">${waterText}</span>
        </span>
        ${dropsHTML}`;
    tooltip.style.opacity='1';
    moveTooltip(e);
}
function moveTooltip(e) {
    const tw=tooltip.offsetWidth, th=tooltip.offsetHeight;
    let lf=e.clientX+16, tp=e.clientY+16;
    if(lf+tw+10>window.innerWidth)  lf=e.clientX-tw-12;
    if(tp+th+10>window.innerHeight) tp=e.clientY-th-12;
    tooltip.style.left=lf+'px'; tooltip.style.top=tp+'px';
}
function hideTooltip(){ tooltip.style.opacity='0'; }

// ═══════════════════════════════════════════════════
//  FAVOURITES
// ═══════════════════════════════════════════════════
function toggleFavourite(name,starBtn) {
    if(favourites.has(name)){ favourites.delete(name); starBtn.classList.remove('active'); }
    else                    { favourites.add(name);    starBtn.classList.add('active'); }
    try{localStorage.setItem('skyYieldFavs',JSON.stringify([...favourites]));}catch(e){}
    renderFavourites();
}
function renderFavourites() {
    const empty=document.getElementById('favEmpty');
    const favGrid=document.getElementById('favGrid');
    if(favourites.size===0){empty.style.display='block';favGrid.style.display='none';return;}
    empty.style.display='none'; favGrid.style.display='grid';
    favGrid.innerHTML='';
    [...favourites].sort().forEach(name=>{
        const data=mutationDatabase[name];
        const color=RARITY_COLORS[data.rarity];
        const item=document.createElement('div');
        item.className='mutation-item'; item.dataset.name=name;
        item.style.setProperty('--rarity-color',color);
        item.style.setProperty('--rarity-glow',hexToRgba(color,0.3));
        item.style.borderColor=hexToRgba(color,0.3);
        if(name===selectedMutation) item.classList.add('selected');
        const img=document.createElement('img');
        img.src=data.image; img.alt=name; img.onerror=()=>{img.style.display='none';};
        item.appendChild(img);
        const star=document.createElement('button');
        star.className='fav-btn active'; star.textContent='★';
        star.addEventListener('click',e=>{
            e.stopPropagation(); toggleFavourite(name,star);
            const ms=document.querySelector(`.mutation-item[data-name="${name}"] .fav-btn`);
            if(ms) ms.classList.remove('active');
        });
        item.appendChild(star);
        item.addEventListener('mouseenter',e=>showTooltip(e,name));
        item.addEventListener('mousemove', e=>moveTooltip(e));
        item.addEventListener('mouseleave',hideTooltip);
        item.addEventListener('click',()=>{
            document.querySelectorAll('.mutation-item').forEach(el=>el.classList.remove('selected'));
            item.classList.add('selected');
            const mi=document.querySelector(`#mutationGrid .mutation-item[data-name="${name}"]`);
            if(mi) mi.classList.add('selected');
            selectedMutation=name; calculate(); switchTab('calculator');
        });
        favGrid.appendChild(item);
    });
}

// ═══════════════════════════════════════════════════
//  BEST BADGE
// ═══════════════════════════════════════════════════
function updateBestBadge() {
    document.querySelectorAll('.best-badge').forEach(b=>b.remove());
    const inp=getInputs();
    let bestName=null, bestScore=-1;
    ALL_NAMES.forEach(name=>{
        const data=mutationDatabase[name];
        if(Object.keys(data.drops).length===0) return;
        const stats=calcMutationStats(name,inp);
        const score=isFinite(stats.coinsPerHour)?stats.coinsPerHour:stats.totalCoins;
        if(score>bestScore){bestScore=score;bestName=name;}
    });
    currentBest=bestName;
    if(!bestName) return;
    const el=document.querySelector(`.mutation-item[data-name="${bestName}"]`);
    if(el){
        const badge=document.createElement('span');
        badge.className='best-badge'; badge.textContent='BEST';
        el.appendChild(badge);
    }
}

// ═══════════════════════════════════════════════════
//  MAIN CALCULATE
// ═══════════════════════════════════════════════════
function calculate() {
    if(!selectedMutation) return;
    const inp  =getInputs();
    const stats=calcMutationStats(selectedMutation,inp);
    const {totalCoins,coinsPerHour,coinsPerStage,totalGrowthSeconds,cropResults}=stats;

    document.getElementById('plotNumber').value=inp.plots;
    document.getElementById('totalCoinsDisplay').textContent=fmtCoins(totalCoins);
    document.getElementById('coinsPerHour').textContent=isFinite(coinsPerHour)?fmtCoins(coinsPerHour):'∞';
    document.getElementById('growthTimeDisplay').textContent=fmtTime(totalGrowthSeconds);
    document.getElementById('coinsPerStage').textContent=fmtCoins(coinsPerStage);

    renderPieChart(cropResults, totalCoins);
    renderProfitColumns(cropResults, totalCoins);
    renderStageTimeline();
    renderRankings();
    renderCompare();
    updateBestBadge();
}

function scheduleCalculate() {
    clearTimeout(debounceTimer);
    debounceTimer=setTimeout(calculate,250);
}

// ═══════════════════════════════════════════════════
//  HIGHCHARTS HELPERS
// ═══════════════════════════════════════════════════
function getHcTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
        isDark,
        textColor:   isDark ? 'rgba(240,240,248,0.65)' : 'rgba(18,20,31,0.65)',
        titleColor:  isDark ? '#f0f0f8' : '#12141f',
        gridColor:   isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
        tooltipBg:   isDark ? 'rgba(6,7,18,0.97)' : 'rgba(245,248,255,0.97)',
        tooltipText: isDark ? '#f0f0f8' : '#12141f',
    };
}

// ═══════════════════════════════════════════════════
//  HIGHCHARTS 3-D PIE CHART
// ═══════════════════════════════════════════════════
function renderPieChart(cropResults, totalCoins) {
    const container = document.getElementById('pieChart');
    if (!container) return;

    if (!cropResults.length || !totalCoins) {
        if (pieChartInstance) { try { pieChartInstance.destroy(); } catch(e){} pieChartInstance = null; }
        container.innerHTML = '';
        return;
    }

    const t = getHcTheme();

    const seriesData = cropResults.map((r, i) => ({
        name:     r.cropName,
        y:        r.coins / totalCoins * 100,
        color:    getCropColor(r.cropName, i),
        coins:    r.coins,
        qty:      r.finalYield,
        npcPrice: npcPrices[r.cropName] ?? 0,
        bzPrice:  bazaarPrices[r.cropName] ?? null,
    }));

    if (pieChartInstance) { try { pieChartInstance.destroy(); } catch(e){} pieChartInstance = null; }

    pieChartInstance = Highcharts.chart('pieChart', {
        chart: {
            type: 'pie',
            backgroundColor: 'transparent',
            style: { fontFamily: 'Inter, sans-serif' },
            options3d: {
                enabled: true,
                alpha: 45,
                beta: 0
            }
        },
        title:    { text: null },
        credits:  { enabled: false },
        legend: {
            enabled: true,
            align: 'center',
            verticalAlign: 'bottom',
            layout: 'horizontal',
            itemStyle: { color: t.textColor, fontWeight: '600', fontSize: '11px' },
        },
        tooltip: {
            useHTML: true,
            formatter: function () {
                const p = this.point;
                const bzLine = p.bzPrice != null
                    ? `<br><span style="color:rgba(240,240,248,0.6)">Bazaar</span> <b style="color:#ffd700">${fmtCoins(p.qty * p.bzPrice)}</b>`
                    : '';
                return `<b style="color:${p.color}">${p.name}</b><br>
                    <span style="color:rgba(240,240,248,0.6)">Qty</span> <b>${p.qty.toLocaleString()}</b><br>
                    <span style="color:rgba(240,240,248,0.6)">NPC (${p.npcPrice}¢/ea)</span> <b style="color:#ffd700">${fmtCoins(p.coins)}</b>
                    ${bzLine}<br>
                    <span style="color:rgba(240,240,248,0.6)">Share</span> <b style="color:${p.color}">${p.percentage.toFixed(1)}%</b>`;
            }
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                depth: 35,
                showInLegend: true,
                dataLabels: {
                    enabled: true,
                    format: '{point.name}',
                    style: { color: t.textColor, textOutline: 'none', fontSize: '10px' }
                }
            }
        },
        series: [{ type: 'pie', name: 'Revenue share', data: seriesData }],
        accessibility: { enabled: false },
    });
}

// ═══════════════════════════════════════════════════
//  HIGHCHARTS GROUPED COLUMN CHART (NPC vs Bazaar)
// ═══════════════════════════════════════════════════
function renderColumnChart(cropResults) {
    const container = document.getElementById('cropColumnChart');
    if (!container) return;

    if (!cropResults.length) {
        if (columnChartInstance) { try { columnChartInstance.destroy(); } catch(e){} columnChartInstance = null; }
        container.innerHTML = '';
        return;
    }

    const t = getHcTheme();

    const categories = cropResults.map(r => r.cropName);

    // NPC bars — solid crop color
    const npcData = cropResults.map((r, i) => {
        const color = getCropColor(r.cropName, i);
        return {
            y:           r.finalYield * (npcPrices[r.cropName] ?? 0),
            color:       color,
            borderColor: darkenColor(color, 0.7),
            borderWidth: 1,
            qty:         r.finalYield,
            unitPrice:   npcPrices[r.cropName] ?? 0,
        };
    });

    // BZ bars — lighter crop color with bright cyan outline
    const bzData = cropResults.map((r, i) => {
        const base  = getCropColor(r.cropName, i);
        const light = lightenColor(base, 1.5);
        const bzp   = bazaarPrices[r.cropName];
        return {
            y:           bzp != null ? r.finalYield * bzp : 0,
            color:       bzp != null ? hexToRgba(base, 0.42) : 'rgba(255,255,255,0.08)',
            borderColor: bzp != null ? '#00e5ff' : 'rgba(255,255,255,0.15)',
            borderWidth: 2,
            qty:         r.finalYield,
            unitPrice:   bzp,
            missing:     bzp == null,
        };
    });

    const bzLoaded = bazaarStatus === 'ok';

    if (columnChartInstance) { try { columnChartInstance.destroy(); } catch(e){} columnChartInstance = null; }

    try {
        columnChartInstance = Highcharts.chart('cropColumnChart', {
            chart: {
                type: 'column',
                backgroundColor: 'transparent',
                animation: { duration: 450 },
                style: { fontFamily: 'Inter, sans-serif' },
                spacing: [12, 12, 8, 8],
            },
            title:    { text: null },
            credits:  { enabled: false },
            xAxis: {
                categories,
                labels: {
                    style: { color: t.textColor, fontSize: '11px', fontWeight: '600' },
                    rotation: 0,
                },
                lineColor:  'transparent',
                tickColor:  'transparent',
                gridLineWidth: 0,
            },
            yAxis: {
                min: 0,
                title: { text: null },
                labels: {
                    style: { color: t.textColor, fontSize: '10px' },
                    formatter: function() { return fmtCoins(this.value); }
                },
                gridLineColor: t.gridColor,
                gridLineWidth: 1,
            },
            legend: {
                enabled: true,
                align: 'right',
                verticalAlign: 'top',
                itemStyle: { color: t.textColor, fontWeight: '700', fontSize: '11px' },
                itemHoverStyle: { color: t.titleColor },
                symbolRadius: 3,
            },
            tooltip: {
                backgroundColor: t.tooltipBg,
                borderColor: t.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
                borderRadius: 12,
                style: { color: t.tooltipText, fontSize: '12px' },
                useHTML: true,
                outside: true,
                formatter: function() {
                    const p    = this.point;
                    const isNPC = this.series.name.includes('NPC');
                    const cropColor = getCropColor(this.point.category, categories.indexOf(this.point.category));
                    const priceStr = p.missing
                        ? '<span style="color:#f87171">Not loaded</span>'
                        : (p.unitPrice != null
                            ? (isNPC ? `${p.unitPrice}¢ / ea` : `${fmtCoins(p.unitPrice)} / ea`)
                            : '—');
                    const totalStr = p.missing ? '—' : `<span style="color:#ffd700;font-weight:800">${fmtCoins(this.y)}</span>`;
                    return `<div class="hc-col-tip">
                        <div class="hc-tip-name" style="color:${cropColor}">${this.point.category}</div>
                        <div class="hc-tt-method">${this.series.name}</div>
                        <div class="hc-tt-row"><span>Quantity</span><span>${p.qty ? p.qty.toLocaleString() : '—'}</span></div>
                        <div class="hc-tt-row"><span>Price</span><span>${priceStr}</span></div>
                        <div class="hc-tt-row"><span>Total coins</span>${totalStr}</div>
                    </div>`;
                }
            },
            plotOptions: {
                column: {
                    borderRadius: 4,
                    groupPadding: 0.12,
                    pointPadding: 0.04,
                    dataLabels: { enabled: false },
                }
            },
            series: [
                {
                    name: '🏪 NPC Sell',
                    data: npcData,
                    legendSymbol: 'rectangle',
                },
                {
                    name: '📈 Bazaar Sell',
                    data: bzData,
                    legendSymbol: 'rectangle',
                    opacity: bzLoaded ? 1 : 0.4,
                },
            ],
            accessibility: { enabled: false },
        });
    } catch(e) { console.warn('Column chart error:', e); }
}

// ═══════════════════════════════════════════════════
//  PROFIT COLUMNS  (NPC + Bazaar side by side)
// ═══════════════════════════════════════════════════
function renderProfitColumns(cropResults, totalCoins) {
    const npcRows=document.getElementById('npcRows');
    const bzRows =document.getElementById('bzRows');
    const npcTotal=document.getElementById('npcColTotal');
    const npcEarn =document.getElementById('npcEarnings');
    const bzEarn  =document.getElementById('bzEarnings');
    const bzBadge =document.getElementById('bazaarLiveBadge');

    npcRows.innerHTML=''; bzRows.innerHTML='';

    // ── Render grouped column chart ────────────────
    renderColumnChart(cropResults || []);

    let npcSum=0, bzSum=0, anyBzMissing=false;

    cropResults.forEach((r,i)=>{
        const color = getCropColor(r.cropName, i);   // ← per-crop colour
        const npcCoins=r.finalYield*(npcPrices[r.cropName]??0);
        npcSum+=npcCoins;

        // NPC row
        const nrow=document.createElement('div');
        nrow.className='profit-row';
        nrow.style.animationDelay=(i*0.05)+'s';
        nrow.innerHTML=`
            <span class="profit-row-dot" style="background:${color}"></span>
            <span class="profit-row-name">${r.cropName}</span>
            <span class="profit-row-qty">${fmt(r.finalYield)}×</span>
            <span class="profit-row-coin">${fmtCoins(npcCoins)}</span>`;
        npcRows.appendChild(nrow);

        // BZ row
        const brow=document.createElement('div');
        brow.className='profit-row';
        brow.style.animationDelay=(i*0.05)+'s';
        let bzCoinStr='—';
        if(bazaarStatus==='ok'&&bazaarPrices[r.cropName]!=null){
            const bzCoins=r.finalYield*bazaarPrices[r.cropName];
            bzSum+=bzCoins;
            bzCoinStr=fmtCoins(bzCoins);
        } else {
            anyBzMissing=true;
        }
        brow.innerHTML=`
            <span class="profit-row-dot" style="background:${color}"></span>
            <span class="profit-row-name">${r.cropName}</span>
            <span class="profit-row-qty">${fmt(r.finalYield)}×</span>
            <span class="profit-row-coin">${bzCoinStr}</span>`;
        bzRows.appendChild(brow);
    });

    npcTotal.textContent='';
    npcEarn.textContent  = fmtCoins(npcSum)+' coins';
    npcEarn.classList.add('gold');

    if(bazaarStatus==='ok'){
        bzEarn.textContent = fmtCoins(bzSum)+(anyBzMissing?' (partial)':'')+' coins';
        bzEarn.classList.add('gold');
    } else {
        bzEarn.textContent='—';
        bzEarn.classList.remove('gold');
    }

    // Badge
    bzBadge.className='bazaar-live-badge';
    if(bazaarStatus==='loading'){ bzBadge.textContent='Loading…'; }
    else if(bazaarStatus==='ok'){
        bzBadge.textContent='Live'; bzBadge.classList.add('ok');
    } else if(bazaarStatus==='error'){
        bzBadge.textContent='Unavailable'; bzBadge.classList.add('error');
    } else {
        bzBadge.textContent='Not loaded';
    }
}

// ═══════════════════════════════════════════════════
//  BAZAAR
// ═══════════════════════════════════════════════════
function setupBazaar() {
    document.getElementById('bazaarRefreshBtn').addEventListener('click',fetchBazaarPrices);
    fetchBazaarPrices();
}
async function fetchBazaarPrices() {
    bazaarStatus='loading';
    renderProfitColumns(selectedMutation ? calcMutationStats(selectedMutation,getInputs()).cropResults : []);
    try {
        const res=await fetch('https://api.hypixel.net/v2/skyblock/bazaar');
        if(!res.ok) throw new Error('Bad response');
        const data=await res.json();
        if(!data.success) throw new Error('API error');
        const prices={};
        for(const [cn,pid] of Object.entries(CROP_BAZAAR_IDS)){
            const prod=data.products[pid];
            prices[cn]=prod?prod.quick_status.sellPrice:null;
        }
        bazaarPrices=prices; bazaarStatus='ok';
    } catch(e){ bazaarStatus='error'; }
    calculate();
}

// ═══════════════════════════════════════════════════
//  STAGE TIMELINE
// ═══════════════════════════════════════════════════
function toLocalInputValue(d) {
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtClock(d) {
    const now=new Date();
    const timeStr=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if(d.toDateString()===now.toDateString()) return timeStr;
    return d.toLocaleDateString([],{month:'short',day:'numeric'})+', '+timeStr;
}
function getPlantedDate() {
    const input=document.getElementById('plantedAt');
    if(input.value){ const d=new Date(input.value); if(!isNaN(d.getTime())) return d; }
    return new Date();
}
function setupPlantedAt() {
    const input=document.getElementById('plantedAt');
    input.value=toLocalInputValue(new Date());
    input.addEventListener('input',renderStageTimeline);
    document.getElementById('plantNowBtn').addEventListener('click',()=>{
        input.value=toLocalInputValue(new Date()); renderStageTimeline();
    });
}
function renderStageTimeline() {
    const container=document.getElementById('stageTimelineList');
    if(!selectedMutation){container.innerHTML='';return;}
    const data=mutationDatabase[selectedMutation];
    const stagesCount=data.stages;
    container.innerHTML='';
    if(stagesCount===0){
        container.innerHTML='<div class="timeline-row instant">⚡ Instant harvest — no stages to schedule</div>';
        return;
    }
    const inp=getInputs();
    const stats=calcMutationStats(selectedMutation,inp);
    const plantedDate=getPlantedDate();
    const perStage=stats.totalGrowthSeconds/stagesCount;
    for(let i=1;i<=stagesCount;i++){
        const completion=new Date(plantedDate.getTime()+perStage*i*1000);
        const row=document.createElement('div');
        row.className='timeline-row';
        row.innerHTML=`<span class="timeline-label">Stage ${i}</span><span class="timeline-time">${fmtClock(completion)}</span>`;
        container.appendChild(row);
    }
}
function setupExport() {
    document.getElementById('exportStagesBtn').addEventListener('click',()=>{
        if(!selectedMutation) return;
        const data=mutationDatabase[selectedMutation];
        if(data.stages===0){alert('Instant harvest — no stages to export.');return;}
        const inp=getInputs();
        const stats=calcMutationStats(selectedMutation,inp);
        const planted=getPlantedDate();
        const perStage=stats.totalGrowthSeconds/data.stages;
        const lines=[`${selectedMutation} — Growth Stage Schedule`,`Planted: ${fmtClock(planted)}`,''];
        for(let i=1;i<=data.stages;i++){
            const c=new Date(planted.getTime()+perStage*i*1000);
            lines.push(`Stage ${i} — ${fmtClock(c)}`);
        }
        const blob=new Blob([lines.join('\n')],{type:'text/plain'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url; a.download=`${selectedMutation.replace(/\s+/g,'_')}_schedule.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    });
}

// ═══════════════════════════════════════════════════
//  COMPARE TAB — custom animated dropdowns
// ═══════════════════════════════════════════════════
function buildCompareDropdowns() {
    buildOneDropdown('A');
    buildOneDropdown('B');
}

function buildOneDropdown(side) {
    const trigger  = document.getElementById(`selectTrigger${side}`);
    const dropdown = document.getElementById(`selectDropdown${side}`);
    const imgEl    = document.getElementById(`selectImg${side}`);
    const nameEl   = document.getElementById(`selectName${side}`);
    const wrap     = document.getElementById(`selectWrap${side}`);

    // Build option list
    function buildOptions() {
        dropdown.innerHTML='';
        const sortedNames=getSortedNames();
        sortedNames.forEach(name=>{
            const data =mutationDatabase[name];
            const color=RARITY_COLORS[data.rarity];
            const opt  =document.createElement('div');
            opt.className='cs-option';
            opt.dataset.name=name;
            const curSel=side==='A'?compareSelA:compareSelB;
            if(name===curSel) opt.classList.add('selected');
            opt.style.borderLeftColor=(name===curSel)?color:'transparent';
            opt.innerHTML=`
                <img src="${data.image}" alt="${name}" onerror="this.style.display='none'">
                <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0">
                    <span class="cs-option-name">${name}</span>
                    <span class="cs-option-rarity" style="color:${color}">${data.rarity}</span>
                </div>`;
            opt.addEventListener('click',()=>{
                if(side==='A') compareSelA=name;
                else           compareSelB=name;
                setTriggerDisplay(side,name,data,color);
                closeDropdown(side);
                renderCompare();
            });
            dropdown.appendChild(opt);
        });
    }

    function openDropdown() {
        buildOptions();
        trigger.classList.add('open');
        dropdown.classList.add('open');
        // scroll to selected
        const sel=dropdown.querySelector('.cs-option.selected');
        if(sel) setTimeout(()=>sel.scrollIntoView({block:'nearest'}),50);
    }
    function closeDropdown(s) {
        const t=document.getElementById(`selectTrigger${s}`);
        const d=document.getElementById(`selectDropdown${s}`);
        t.classList.remove('open');
        d.classList.remove('open');
    }

    trigger.addEventListener('click',e=>{
        e.stopPropagation();
        const isOpen=dropdown.classList.contains('open');
        // close both
        closeDropdown('A'); closeDropdown('B');
        if(!isOpen) openDropdown();
    });

    // Set initial display
    const initName=side==='A'?compareSelA:compareSelB;
    const initData=mutationDatabase[initName];
    const initColor=RARITY_COLORS[initData.rarity];
    setTriggerDisplay(side,initName,initData,initColor);

    // Close on outside click
    document.addEventListener('click',e=>{
        if(!wrap.contains(e.target)) closeDropdown(side);
    });
}

function setTriggerDisplay(side,name,data,color) {
    const imgEl  =document.getElementById(`selectImg${side}`);
    const nameEl =document.getElementById(`selectName${side}`);
    imgEl.src=data.image; imgEl.alt=name;
    nameEl.textContent=name;
    nameEl.style.color=color;
}

// ═══════════════════════════════════════════════════
//  RENDER COMPARE
// ═══════════════════════════════════════════════════
function renderCompare() {
    if(!compareSelA||!compareSelB) return;
    const inp   =getInputs();
    const statsA=calcMutationStats(compareSelA,inp);
    const statsB=calcMutationStats(compareSelB,inp);
    const dataA =mutationDatabase[compareSelA];
    const dataB =mutationDatabase[compareSelB];
    const container=document.getElementById('compareCards');
    container.innerHTML='';

    [[compareSelA,dataA,statsA],[compareSelB,dataB,statsB]].forEach(([name,data,stats],idx)=>{
        const other=idx===0?statsB:statsA;
        const color=RARITY_COLORS[data.rarity];
        const card=document.createElement('div');
        card.className='compare-card';
        card.style.borderTopColor=color;

        const header=document.createElement('div');
        header.className='compare-card-header';
        const img=document.createElement('img');
        img.className='compare-card-img'; img.src=data.image; img.alt=name;
        img.onerror=()=>{img.style.display='none';};
        const info=document.createElement('div');
        info.innerHTML=`
            <div class="compare-card-name" style="color:${color}">${name}</div>
            <div class="compare-card-rarity" style="color:${color}">${data.rarity}</div>
            <div class="compare-card-water">${data.requiresWater?'💧 Requires Water':'🌱 No Water'}</div>`;
        header.appendChild(img); header.appendChild(info);
        card.appendChild(header);

        const statDefs=[
            {label:'Total Coins',   va:stats.totalCoins,        vb:other.totalCoins,        fmt:fmtCoins, hb:true },
            {label:'Coins/Hour',    va:stats.coinsPerHour,      vb:other.coinsPerHour,      fmt:fmtCoins, hb:true },
            {label:'Coins/Stage',   va:stats.coinsPerStage,     vb:other.coinsPerStage,     fmt:fmtCoins, hb:true },
            {label:'Growth Time',   va:stats.totalGrowthSeconds,vb:other.totalGrowthSeconds,fmt:fmtTime,  hb:false},
            {label:'Stages',        va:data.stages,             vb:(idx===0?mutationDatabase[compareSelB]:mutationDatabase[compareSelA]).stages,
             fmt:v=>v===0?'Instant':String(v), hb:false},
        ];
        statDefs.forEach(({label,va,vb,fmt:fmtFn,hb})=>{
            const row=document.createElement('div');
            row.className='compare-stat-row';
            const lbl=document.createElement('span'); lbl.className='csr-label'; lbl.textContent=label;
            const val=document.createElement('span'); val.className='csr-value';
            const winner=hb?(va>vb):(va<vb);
            if(winner) val.classList.add('winner');
            val.textContent=fmtFn(va);
            row.appendChild(lbl); row.appendChild(val); card.appendChild(row);
        });

        // Drops header
        const dh=document.createElement('div');
        dh.className='csr-label'; dh.style.marginTop='6px'; dh.textContent='Base Drops';
        card.appendChild(dh);

        Object.entries(data.drops).forEach(([crop,amt])=>{
            const row=document.createElement('div');
            row.className='compare-stat-row';
            const l=document.createElement('span'); l.className='csr-label'; l.textContent=crop;
            const v=document.createElement('span'); v.className='csr-value'; v.textContent=fmt(amt);
            row.appendChild(l); row.appendChild(v); card.appendChild(row);
        });

        container.appendChild(card);
    });
}

// ═══════════════════════════════════════════════════
//  RANKINGS TAB
// ═══════════════════════════════════════════════════
function renderRankings() {
    const list=document.getElementById('rankingsList');
    list.innerHTML='';
    const inp=getInputs();
    const scored=ALL_NAMES
        .filter(n=>Object.keys(mutationDatabase[n].drops).length>0)
        .map(n=>{const stats=calcMutationStats(n,inp);return{name:n,stats};})
        .sort((a,b)=>{
            const sa=isFinite(a.stats.coinsPerHour)?a.stats.coinsPerHour:a.stats.totalCoins;
            const sb=isFinite(b.stats.coinsPerHour)?b.stats.coinsPerHour:b.stats.totalCoins;
            return sb-sa;
        });
    scored.forEach(({name,stats},i)=>{
        const data=mutationDatabase[name];
        const color=RARITY_COLORS[data.rarity];
        const rank=i+1;
        const item=document.createElement('div');
        item.className='rank-item';
        item.style.borderLeftColor=color;
        item.innerHTML=`
            <span class="rank-num${rank<=3?' top3':''}">#${rank}</span>
            <img class="rank-img" src="${data.image}" alt="${name}" onerror="this.style.display='none'">
            <div class="rank-info">
                <span class="rank-name" style="color:${color}">${name}</span>
                <span class="rank-rarity" style="color:${color}">${data.rarity}</span>
            </div>
            <div class="rank-stats">
                <div class="rank-stat"><span class="rs-label">Coins/hr</span><span class="rs-val gold">${fmtCoins(stats.coinsPerHour)}</span></div>
                <div class="rank-stat"><span class="rs-label">Total</span><span class="rs-val">${fmtCoins(stats.totalCoins)}</span></div>
                <div class="rank-stat"><span class="rs-label">Time</span><span class="rs-val">${fmtTime(stats.totalGrowthSeconds)}</span></div>
            </div>`;
        const btn=document.createElement('button');
        btn.className='rank-select-btn'; btn.textContent='Select';
        btn.addEventListener('click',()=>{
            selectedMutation=name;
            document.querySelectorAll('.mutation-item').forEach(el=>el.classList.remove('selected'));
            const gi=document.querySelector(`.mutation-item[data-name="${name}"]`);
            if(gi){gi.classList.add('selected');gi.scrollIntoView({behavior:'smooth',block:'nearest'});}
            switchTab('calculator'); calculate();
        });
        item.appendChild(btn);
        list.appendChild(item);
    });
}

// ═══════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════
function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab=>{
        tab.addEventListener('click',()=>switchTab(tab.dataset.tab));
    });
}
function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.toggle('active',c.id===`tab-${name}`));
    if(name==='rankings')   renderRankings();
    if(name==='favourites') renderFavourites();
    if(name==='compare')    { buildCompareDropdowns(); renderCompare(); }
}

// ═══════════════════════════════════════════════════
//  SEARCH
// ═══════════════════════════════════════════════════
function setupSearch() {
    document.getElementById('searchBar').addEventListener('input',refreshGrid);
}
function refreshGrid() {
    const q=document.getElementById('searchBar').value.trim().toLowerCase();
    const base=getSortedNames();
    renderGrid(q?base.filter(n=>n.toLowerCase().includes(q)):base);
}

// ═══════════════════════════════════════════════════
//  SORT TOGGLE — 4 buttons
// ═══════════════════════════════════════════════════
function setupSortToggle() {
    document.querySelectorAll('.sort-btn').forEach(btn=>{
        if(btn.dataset.sort===currentSort) btn.classList.add('active');
        else btn.classList.remove('active');
        btn.addEventListener('click',()=>{
            currentSort=btn.dataset.sort;
            try{localStorage.setItem('skyYieldSort',currentSort);}catch(e){}
            document.querySelectorAll('.sort-btn').forEach(b=>b.classList.toggle('active',b===btn));
            refreshGrid();
        });
    });
}

// ═══════════════════════════════════════════════════
//  THEME TOGGLE
// ═══════════════════════════════════════════════════
function setupThemeToggle() {
    const btn=document.getElementById('themeToggle');
    // Restore saved theme
    try{
        const saved=localStorage.getItem('skyYieldTheme');
        if(saved) document.documentElement.setAttribute('data-theme',saved);
    }catch(e){}
    btn.addEventListener('click',()=>{
        const isLight=document.documentElement.getAttribute('data-theme')==='light';
        const next=isLight?'dark':'light';
        document.documentElement.setAttribute('data-theme',next);
        try{localStorage.setItem('skyYieldTheme',next);}catch(e){}
        calculate(); // Re-render Highcharts with new theme colors
    });
}

// ═══════════════════════════════════════════════════
//  INPUT LISTENERS
// ═══════════════════════════════════════════════════
function setupInputListeners() {
    ['uniqueYield','plantYield','effectYield','chipYield','fortune',
     'mutationsPerPlot','plotNumber','uniqueCrops','cropGrowth','ghUpgrade']
    .forEach(id=>{
        document.getElementById(id).addEventListener('input',scheduleCalculate);
    });
}

// ═══════════════════════════════════════════════════
//  TOOLS MENU
// ═══════════════════════════════════════════════════
function setupToolsMenu() {
    const btn=document.getElementById('toolsMenuBtn');
    const dd =document.getElementById('toolsMenuDropdown');
    btn.addEventListener('click',e=>{e.stopPropagation();dd.classList.toggle('open');});
    document.addEventListener('click',e=>{
        if(!dd.contains(e.target)&&e.target!==btn) dd.classList.remove('open');
    });
}
