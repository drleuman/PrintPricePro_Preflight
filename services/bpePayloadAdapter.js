/**
 * BPE Payload Adapter
 * 
 * Translates BPE smoke-test and API payloads into V3 normalized specs.
 */
class BPEPayloadAdapter {
    /**
     * Normalizes a raw payload from BPE.
     * @param {Object} raw 
     * @returns {Object} Normalized ProductionSpecs
     */
    normalize(raw) {
        if (!raw) return {};

        const rawPaperType = raw['paper interior (type)'] || raw.paper_type_interior || raw.paperType;

        return {
            bindingType: this.mapBinding(raw['binding method'] || raw.binding_method || raw.bindingType),
            paperType: this.mapPaperType(rawPaperType),
            paperTypeRaw: rawPaperType || null,
            paperGsm: this.toInt(raw['interior paper weight (gsm)'] || raw.paper_gsm_interior || raw.paperGsm || 130),
            pageCount: this.toInt(raw['interior pages'] || raw.interior_pages || raw.pageCount || 0),
            hasEndpapers: this.toBoolean(raw.endpapers || raw.has_endpapers || raw.hasEndpapers),
            endpaperType: this.mapPaperType(raw.paper_type_endpaper || raw.endpaperType),
            endpaperGsm: this.toInt(raw.paper_weight_endpapers || raw.endpaperGsm || 120),
            // Parse dimensions if available (e.g. "150x210")
            ...this.parseDimensions(raw['book size'] || raw.book_size || raw.trimSize)
        };
    }

    mapBinding(val) {
        if (!val) return null;
        const s = String(val).toLowerCase();
        if (s.includes('perfect')) return 'perfect';
        if (s.includes('hardcover') || s.includes('case')) return 'hardcover_casebound';
        if (s.includes('saddle') || s.includes('staple')) return 'saddle';
        if (s.includes('sewn')) return 'sewn_bound';
        return 'perfect'; // Default
    }

    mapPaperType(val) {
        if (!val) return 'coated';
        const s = String(val).toLowerCase();
        if (s.includes('uncoated') || s.includes('offset')) return 'uncoated';
        return 'coated';
    }

    parseDimensions(val) {
        if (!val) return {};
        // Support "WxH", "W x H", "W×H", "W*H"
        const clean = String(val).replace(/mm/gi, '').replace(/×/g, 'x').replace(/\*/g, 'x');
        const parts = clean.split('x').map(p => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return { trimWidthMm: parts[0], trimHeightMm: parts[1] };
        }
        return {};
    }

    toBoolean(val) {
        if (val === undefined || val === null) return false;
        if (typeof val === 'boolean') return val;
        const s = String(val).trim().toLowerCase();
        return ['1', 'true', 'yes', 'on'].includes(s);
    }

    toInt(val, fallback = 0) {
        if (val === undefined || val === null) return fallback;
        const n = parseInt(val, 10);
        return isNaN(n) ? fallback : n;
    }
}

module.exports = new BPEPayloadAdapter();
