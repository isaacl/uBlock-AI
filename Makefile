# https://stackoverflow.com/a/6273809
run_options := $(filter-out $@,$(MAKECMDGOALS))

.PHONY: all clean lint \
	mv3-chromium mv3-firefox mv3-edge mv3-safari

extension-sources := $(shell find ./extension -type f)
platform-sources  := $(wildcard chromium/*) $(wildcard firefox/*) \
                     $(wildcard edge/*) $(wildcard safari/*)

all: mv3-chromium

# Dev tools
node_modules:
	npm install

init: node_modules

lint: init
	npm run lint

dist/build/uBOLite.chromium: tools/make-mv3.sh $(extension-sources) $(platform-sources)
	tools/make-mv3.sh chromium

mv3-chromium: dist/build/uBOLite.chromium

dist/build/uBOLite.firefox: tools/make-mv3.sh $(extension-sources) $(platform-sources)
	tools/make-mv3.sh firefox

mv3-firefox: dist/build/uBOLite.firefox

dist/build/uBOLite.edge: tools/make-mv3.sh $(extension-sources) $(platform-sources)
	tools/make-mv3.sh edge

mv3-edge: dist/build/uBOLite.edge

dist/build/uBOLite.safari: tools/make-mv3.sh $(extension-sources) $(platform-sources)
	tools/make-mv3.sh safari

mv3-safari: dist/build/uBOLite.safari

clean:
	rm -rf dist/build node_modules
