import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('source_audit',Path(__file__).with_name('audit_sources.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
import sys
sys.path.insert(0,str(Path(__file__).parent))
from derive_spacing_corrections import corrections

class OriginalComparisonTests(unittest.TestCase):
    def test_complete_normalized_text(self):
        status,proof,diff=audit.comparison('The Government\nshall act.','The  Government shall act.')
        self.assertEqual(status,'matched_original_normalized')
        self.assertEqual(proof['normalized_source_sha256'],proof['normalized_stored_sha256'])
    def test_character_stream_has_separate_scope(self):
        status,proof,diff=audit.comparison('Cases before the Cabinet.','Cases b efore the Cabinet.')
        self.assertEqual(status,'matched_original_character_stream')
        self.assertNotEqual(proof['normalized_source_sha256'],proof['normalized_stored_sha256'])
        self.assertEqual(proof['source_character_stream_sha256'],proof['stored_character_stream_sha256'])
    def test_negation_is_material(self):
        self.assertEqual(audit.comparison('The Court shall not act.','The Court shall act.')[0],'material_difference_unresolved')
    def test_punctuation_and_numerals_are_material(self):
        self.assertEqual(audit.comparison('Section 14A(1): power.','Section 14(1); power.')[0],'material_difference_unresolved')
    def test_missing_tail_is_material(self):
        self.assertEqual(audit.comparison('Act text.\nSchedule: retained.','Act text.')[0],'material_difference_unresolved')
    def test_typography_normalization_is_explicit(self):
        self.assertEqual(audit.comparison('“Law”\u00ad','"Law"')[0],'matched_original_normalized')
    def test_url_encoding_is_not_a_new_identity(self):
        self.assertEqual(audit.urlkey('https://example.test/A%3D/'),audit.urlkey('https://example.test/A='))
    def test_spacing_fix_requires_unique_original_context(self):
        source='This uniquely identified legislative provision requires the necessary books to be retained by the Government.'
        stored=source.replace('necessary','necessa ry')
        found=corrections(stored,source,{'sha256':'a'*64})
        self.assertEqual(len(found),1)
        c=found[0]
        self.assertEqual(stored[c['character_start']:c['character_end']],' ')
        fixed=stored[:c['character_start']]+c['replacement']+stored[c['character_end']:]
        self.assertEqual(fixed,source)
    def test_spacing_fix_rejects_real_word_space(self):
        source='This uniquely identified legislative provision requires the necessary books to be retained by the Government.'
        self.assertEqual(corrections(source,source,{'sha256':'a'*64}),[])
    def test_spacing_fix_rejects_short_or_repeated_context(self):
        self.assertEqual(corrections('a b','ab',{'sha256':'a'*64}),[])

if __name__=='__main__':unittest.main()
