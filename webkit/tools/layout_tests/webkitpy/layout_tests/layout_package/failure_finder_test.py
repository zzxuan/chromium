#!/bin/env/python
# Copyright (c) 2006-2009 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

import os
import zipfile

from failure_finder import FailureFinder

TEST_BUILDER_OUTPUT = """090723 10:38:22 test_shell_thread.py:289
            ERROR chrome/fast/forms/textarea-metrics.html failed:
              Text diff mismatch
            090723 10:38:21 test_shell_thread.py:289
            ERROR chrome/fast/dom/xss-DENIED-javascript-variations.html failed:
              Text diff mismatch
            090723 10:37:58 test_shell_thread.py:289
            ERROR LayoutTests/plugins/bindings-test.html failed:
              Text diff mismatch

------------------------------------------------------------------------------
Expected to crash, but passed (1):
  chrome/fast/forms/textarea-metrics.html

Regressions: Unexpected failures (2):
  chrome/fast/dom/xss-DENIED-javascript-variations.html = FAIL
  LayoutTests/plugins/bindings-test.html = FAIL
------------------------------------------------------------------------------
"""

TEST_FAILURE_1 = ("layout-test-results/chrome/fast/forms/"
                  "textarea-metrics-actual.txt")
TEST_FAILURE_2 = ("layout-test-results/chrome/fast/dom/"
                  "xss-DENIED-javascript-variations-actual.txt")
TEST_FAILURE_3 = ("layout-test-results/LayoutTests/plugins/"
                  "bindings-test-actual.txt")

TEST_ARCHIVE_OUTPUT = """
Adding layout-test-results\pending\fast\repaint\not-real-actual.checksum
Adding layout-test-results\pending\fast\repaint\not-real-actual.png
Adding layout-test-results\pending\fast\repaint\not-real-actual.txt
last change: 22057
build name: webkit-rel
host name: codf138
saving results to \\my\test\location\webkit-rel\22057
program finished with exit code 0
"""

TEST_TEST_EXPECTATIONS = """
BUG1234 chrome/fast/forms/textarea-metrics.html = CRASH
"""

TEST_BUILDER_LOG_FILE = "TEST_builder.log"
TEST_ARCHIVE_LOG_FILE = "TEST_archive.log"
TEST_DUMMY_ZIP_FILE = "TEST_zipfile.zip"
TEST_EXPECTATIONS_FILE = "TEST_expectations.txt"

WEBKIT_BUILDER_NUMBER = "9800"
WEBKIT_FAILURES = (
  ["LayoutTests/fast/backgrounds/animated-svg-as-mask.html",
   "LayoutTests/fast/backgrounds/background-clip-text.html",
   "LayoutTests/fast/backgrounds/mask-composite.html",
   "LayoutTests/fast/backgrounds/repeat/mask-negative-offset-repeat.html",
   "LayoutTests/fast/backgrounds/svg-as-background-3.html",
   "LayoutTests/fast/backgrounds/svg-as-background-6.html",
   "LayoutTests/fast/backgrounds/svg-as-mask.html",
   "LayoutTests/fast/block/float/013.html",
   "LayoutTests/fast/block/float/nested-clearance.html",
   "LayoutTests/fast/block/positioning/047.html"])

CHROMIUM_BASELINE = "chrome/fast/forms/basic-buttons.html"
EXPECTED_CHROMIUM_LOCAL_BASELINE = "./chrome/fast/forms/basic-buttons.html"
EXPECTED_CHROMIUM_URL_BASELINE = ("http://src.chromium.org/viewvc/chrome/"
                                  "trunk/src/webkit/data/layout_tests/chrome/"
                                  "fast/forms/basic-buttons.html")

WEBKIT_BASELINE = "LayoutTests/fast/forms/11423.html"
EXPECTED_WEBKIT_LOCAL_BASELINE = "./LayoutTests/fast/forms/11423.html"
EXPECTED_WEBKIT_URL_BASELINE = (
    "http://svn.webkit.org/repository/webkit/trunk/"
    "LayoutTests/fast/forms/11423.html")

TEST_ZIP_FILE = ("http://build.chromium.org/buildbot/layout_test_results/"
                 "webkit-rel/21432/layout-test-results.zip")

EXPECTED_REVISION = "20861"
EXPECTED_BUILD_NAME = "webkit-rel"

SVG_TEST_EXPECTATION = (
    "LayoutTests/svg/custom/foreign-object-skew-expected.png")
SVG_TEST_EXPECTATION_UPSTREAM = ("LayoutTests/svg/custom/"
                                 "foreign-object-skew-expected-upstream.png")
WEBARCHIVE_TEST_EXPECTATION = ("LayoutTests/webarchive/adopt-attribute-"
                               "styled-body-webarchive-expected.webarchive")
DOM_TEST_EXPECTATION = ("LayoutTests/fast/dom/"
                        "attribute-downcast-right-expected.txt")
DOM_TEST_EXPECTATION_UPSTREAM = ("LayoutTests/fast/dom/"
                                 "attribute-downcast-right-"
                                 "expected-upstream.png")

TEST_EXPECTATIONS = """
BUG1234 WONTFIX : LayoutTests/fast/backgrounds/svg-as-background-3.html = FAIL
BUG3456 WIN : LayoutTests/fast/backgrounds/svg-as-background-6.html = CRASH
BUG4567 : LayoutTests/fast/backgrounds/svg-as-mask.html = PASS
WONTFIX : LayoutTests/fast/block/ = FAIL
"""

EXPECT_EXACT_MATCH = "LayoutTests/fast/backgrounds/svg-as-background-6.html"
EXPECT_GENERAL_MATCH = "LayoutTests/fast/block/float/013.html"
EXPECT_NO_MATCH = "LayoutTests/fast/backgrounds/svg-as-background-99.html"

WEBKIT_ORG = "webkit.org"
CHROMIUM_ORG = "chromium.org"


class FailureFinderTest(object):

    def runTests(self):
        all_tests_passed = True

        tests = ["testWhitespaceInBuilderName",
                 "testGetLastBuild",
                 "testFindMatchesInBuilderOutput",
                 "testScrapeBuilderOutput",
                 "testGetChromiumBaseline",
                 "testGetWebkitBaseline",
                 "testZipDownload",
                 "testUseLocalOutput",
                 "testTranslateBuildToZip",
                 "testGetBaseline",
                 "testFindTestExpectations",
                 "testFull"]

        for test in tests:
            try:
                result = eval(test + "()")
                if result:
                    print "[ OK      ] %s" % test
                else:
                    all_tests_passed = False
                    print "[    FAIL ] %s" % test
            except:
                print "[  ERROR  ] %s" % test
        return all_tests_passed


def _get_basic_failure_finder():
    return FailureFinder(None, "Webkit", False, "", ".", 10, False)


def _test_last_build(failure_finder):
    try:
        last_build = failure_finder.get_last_build()
        # Verify that last_build is not empty and is a number.
        build = int(last_build)
        return (build > 0)
    except:
        return False


def test_get_last_build():
    test = _get_basic_failure_finder()
    return _test_last_build(test)


def test_whitespace_in_builder_name():
    test = _get_basic_failure_finder()
    test.set_platform("Webkit (webkit.org)")
    return _test_last_build(test)


def test_scrape_builder_output():

    # Try on the default builder.
    test = _get_basic_failure_finder()
    test.build = "9800"
    output = test._scrape_builder_output()
    if not output:
        return False

    # Try on a crazy builder on the FYI waterfall.
    test = _get_basic_failure_finder()
    test.build = "1766"
    test.set_platform("Webkit Linux (webkit.org)")
    output = test._scrape_builder_output()
    if not output:
        return False

    return True


def test_find_matches_in_builder_output():
    test = _get_basic_failure_finder()
    test.exclude_known_failures = True
    matches = test._find_matches_in_builder_output(TEST_BUILDER_OUTPUT)
    # Verify that we found x matches.
    if len(matches) != 2:
        print "Did not find all unexpected failures."
        return False

    test.exclude_known_failures = False
    matches = test._find_matches_in_builder_output(TEST_BUILDER_OUTPUT)
    if len(matches) != 3:
        print "Did not find all failures."
        return False
    return True


def _test_baseline(test_name, expected_local, expected_url):
    test = _get_basic_failure_finder()
    # Test baseline that is obviously in Chromium's tree.
    baseline = test._get_baseline(test_name, ".", False)
    try:
        os.remove(baseline.local_file)
        if (baseline.local_file != expected_local or
            baseline.baseline_url != expected_url):
            return False
    except:
        return False
    return True


def test_get_chromium_baseline():
    return _test_baseline(CHROMIUM_BASELINE, EXPECTED_CHROMIUM_LOCAL_BASELINE,
                         EXPECTED_CHROMIUM_URL_BASELINE)


def test_get_webkit_baseline():
    return _test_baseline(WEBKIT_BASELINE, EXPECTED_WEBKIT_LOCAL_BASELINE,
                         EXPECTED_WEBKIT_URL_BASELINE)


def test_use_local_output():
    test_result = True
    try:
        _write_file(TEST_BUILDER_LOG_FILE, TEST_BUILDER_OUTPUT)
        _write_file(TEST_ARCHIVE_LOG_FILE, TEST_ARCHIVE_OUTPUT)
        _write_file(TEST_EXPECTATIONS_FILE, TEST_TEST_EXPECTATIONS)
        zip = zipfile.ZipFile(TEST_DUMMY_ZIP_FILE, 'w')
        zip.write(TEST_BUILDER_LOG_FILE, TEST_FAILURE_1)
        zip.write(TEST_BUILDER_LOG_FILE, TEST_FAILURE_2)
        zip.write(TEST_BUILDER_LOG_FILE, TEST_FAILURE_3)
        zip.close()
        test = _get_basic_failure_finder()
        test.archive_step_log_file = TEST_ARCHIVE_LOG_FILE
        test.builder_output_log_file = TEST_BUILDER_LOG_FILE
        test.test_expectations_file = TEST_EXPECTATIONS_FILE
        test.zip_file = TEST_DUMMY_ZIP_FILE
        test.dont_download = True
        test.exclude_known_failures = True
        test.delete_zip_file = False
        failures = test.get_failures()
        if not failures or len(failures) != 2:
            print "Did not get expected number of failures :"
            for failure in failures:
                print failure.test_path
            test_result = False
    finally:
        os.remove(TEST_BUILDER_LOG_FILE)
        os.remove(TEST_ARCHIVE_LOG_FILE)
        os.remove(TEST_EXPECTATIONS_FILE)
        os.remove(TEST_DUMMY_ZIP_FILE)
    return test_result


def _write_file(filename, contents):
    myfile = open(filename, 'w')
    myfile.write(contents)
    myfile.close()


def test_zip_download():
    test = _get_basic_failure_finder()
    try:
        test._download_file(TEST_ZIP_FILE, "test.zip", "b") # "b" -> binary
        os.remove("test.zip")
        return True
    except:
        return False


def test_translate_build_to_zip():
    test = _get_basic_failure_finder()
    test.build = WEBKIT_BUILDER_NUMBER
    revision, build_name = test._get_revision_and_build_from_archive_step()
    if revision != EXPECTED_REVISION or build_name != EXPECTED_BUILD_NAME:
        return False
    return True


def test_get_baseline():
    test = _get_basic_failure_finder()
    result = True
    test.platform = "chromium-mac"
    baseline = test._get_baseline(WEBARCHIVE_TEST_EXPECTATION, ".")
    if not baseline.local_file or baseline.baseline_url.find(WEBKIT_ORG) == -1:
        result = False
        print "Webarchive layout test not found at webkit.org: %s" % url
    test.platform = "chromium-win"
    baseline = test._get_baseline(SVG_TEST_EXPECTATION, ".")
    if (not baseline.local_file or
        baseline.baseline_url.find(CHROMIUM_ORG) == -1):
        result = False
        print "SVG layout test found at %s, not chromium.org" % url
    baseline = test._get_baseline(SVG_TEST_EXPECTATION, ".", True)
    if not baseline.local_file or baseline.baseline_url.find(WEBKIT_ORG) == -1:
        result = False
        print "Upstream SVG layout test NOT found at webkit.org!"
    baseline = test._get_baseline(DOM_TEST_EXPECTATION, ".", True)
    if (not baseline.local_file or
        baseline.baseline_url.find("/platform/") > -1):
        result = False
        print ("Upstream SVG layout test found in a "
               "platform directory: %s" % url)
    os.remove(WEBARCHIVE_TEST_EXPECTATION)
    os.remove(SVG_TEST_EXPECTATION)
    os.remove(SVG_TEST_EXPECTATION_UPSTREAM)
    os.remove(DOM_TEST_EXPECTATION_UPSTREAM)
    delete_dir("LayoutTests")
    return result


def delete_dir(directory):
    """ Recursively deletes empty directories given a root.
    This method will throw an exception if they are not empty. """
    for root, dirs, files in os.walk(directory, topdown=False):
        for d in dirs:
            try:
                os.rmdir(os.path.join(root, d))
            except:
                pass
    os.rmdir(directory)


def test_full():
    """ Verifies that the entire system works end-to-end. """
    test = _get_basic_failure_finder()
    test.build = WEBKIT_BUILDER_NUMBER
    test.dont_download = True  # Dry run only, no downloading needed.
    failures = test.get_failures()
    # Verify that the max failures parameter works.
    if not failures or len(failures) > 10:
        "Got no failures or too many failures."
        return False

    # Verify the failures match the list of expected failures.
    for failure in failures:
        if not (failure.test_path in WEBKIT_FAILURES):
            print "Found a failure I did not expect to see."
            return False

    return True


def test_find_test_expectations():
    test = _get_basic_failure_finder()
    test._test_expectations_cache = TEST_EXPECTATIONS
    match = test._get_test_expectations_line(EXPECT_EXACT_MATCH)
    if not match:
        return False
    match = test._get_test_expectations_line(EXPECT_GENERAL_MATCH)
    if not match:
        return False
    match = test._get_test_expectations_line(EXPECT_NO_MATCH)
    return not match


if __name__ == "__main__":
    fft = FailureFinderTest()
    result = fft.runTests()
    if result:
        print "All tests passed."
    else:
        print "Not all tests passed."
