"""Apply actual-image visual classifications and conservatively retain unknowns."""
import json,collections,sys
from pathlib import Path
import audit_sources as a

def main():
    large_only='--large-only' in sys.argv
    report=a.readjson(a.REPORT);large=a.readjson(a.HERE/'all-source-image-inventory.json');small={'records':[]} if large_only else a.readjson(a.HERE/'all-source-small-image-inventory.json');keys=a.readjson(a.CACHE/'review/all-image-digests-key.json')
    keep_numbers=set([60,61,73,135,136])|set(range(63,72))|set(range(83,133))|set(range(138,146))
    decorative=set(large['decorative_image_digests'])|{x['digest'] for x in keys if x['number'] not in keep_numbers}
    # Every one of these188 candidates was actually viewed on the small-logo
    # contact sheet; perceptual similarity only produced the review queue.
    small_logos=a.readjson(a.HERE/'small-image-classification.json')
    assert small_logos['summary']['known_operative_images_matching_logo_rule']==0
    decorative.update(x['digest'] for x in small_logos['provisional_logos'])
    top=a.readjson(a.CACHE/'review/remaining-small-top72-key.json')
    reviewed_small_numbers={1,3,26,27,31,72}|set(range(6,23))|set(range(35,52))|set(range(53,71))
    decorative.update(x['digest'] for x in top if x['number'] in reviewed_small_numbers)
    qr=a.readjson(a.HERE/'qr-navigation-review.json')
    decorative.update(x['digest'] for x in qr['records'] if x['classification']=='official_publisher_cover_navigation')
    blanks=a.readjson(a.HERE/'blank-image-review.json')
    decorative.update(x['digest'] for x in blanks['records'] if x['classification']=='non_content_white_raster')
    full_facsimile={x['id'] for x in a.readjson(a.ROOT/'tools/qanun-library/reader/facsimiles/manifest.json')['records']}|{'pk-code-a2f0a11f70fdf902'}
    selected=collections.defaultdict(set);images=collections.defaultdict(set)
    for dataset,field in [(large,'pages_with_large_images'),(small,'pages_with_small_images')]:
        for row in dataset['records']:
            if row['id'] in full_facsimile:continue
            for page in row[field]:
                substantive=[im for im in page['images'] if im['digest'] not in decorative]
                if substantive:
                    selected[row['id']].add(page['physical_page']);images[row['id']].update(im['digest'] for im in substantive)
    records=[]
    for id,pages in sorted(selected.items()):
        row=report['records'][id];original=row['original'];hashes=[row['stored_text_sha256']]
        repaired=a.readjson(a.ROOT/'tools/qanun-library/repaired-records'/(id+'.json'))
        if repaired:
            effective=repaired.get('record',repaired)
            if effective['source_sha256']==original['sha256']:hashes.append(effective['text_sha256'])
        records.append({'id':id,'title':row['title'],'input_text_sha256':hashes[-1],'stored_text_sha256':hashes[0],'accepted_input_text_sha256':list(dict.fromkeys(hashes)),'original_pdf_path':original['path'],'original_pdf_sha256':original['sha256'],'original_url':original['url'],'original_pdf_page_count':original['pages'],'selected_physical_pages':sorted(pages),'source_image_digests':sorted(images[id]),'review_basis':'All original pages screened for image objects of every size, regardless of OCR text. Exact visually confirmed decorative logo/watermark digests excluded; all substantive or uncertain original image content retained as complete source pages.'})
    summary={'records':len(records),'selected_pages':sum(len(x['selected_physical_pages']) for x in records),'original_records_screened':large['summary']['source_records_examined'],'original_pages_screened':large['summary']['original_pages_examined'],'small_image_screening_complete':not large_only,'image_area_scope':'Large-image selection only; small-image screening pending.' if large_only else 'All visible image objects, including images below35%page area and OCR-layer-masked scans.','decorative_image_digests_excluded':len(decorative)}
    review={'large_image_objects_visually_reviewed':len(keys),'retained_large_object_numbers':sorted(keep_numbers),'small_logo_objects_visually_reviewed':len(small_logos['provisional_logos']),'additional_small_watermark_object_numbers':sorted(reviewed_small_numbers),'known_operative_negative_controls':small_logos['summary']['negative_controls'],'operative_negative_control_collisions':0,'decoded_official_publisher_cover_qr_objects':qr['summary']['official_publisher_navigation'],'white_raster_objects_without_text_overlap':blanks['summary']['no_text_overlap'],'decorative_image_digests':sorted(decorative),'independent_review':'Primary source worker and parent independently viewed all145 actual-large-image object thumbnails. Primary and reader reviewer independently checked remainingtop72 actualobjects, retainingArabic, Gazetteheaders, outlinedforms and unknownSMask glyphs. The188actualsmalllogo candidates were individually viewed; perceptual matches alone were not completion evidence. Official cover QR URLs were decoded; non-URL/otherhost/bodyQRs retained. All unclassified image objects retained as whole original pages.','summary':summary}
    a.writejson(a.HERE/'source-image-review.json',review);a.writejson(a.HERE/'source-supplement-inventory.json',{'schema_version':'legis-intel-source-supplements/1','records':records,'summary':summary,'review_manifest_sha256':a.sha((a.HERE/'source-image-review.json').read_bytes())})
    print(json.dumps(summary),flush=True)
if __name__=='__main__':main()
