IMAGE_NAME ?= portfolio-comparator
IMAGE_TAG  ?= latest
VERSION    ?= # e.g. v1.2.0 — if set, image is also tagged with this version
REGISTRY   ?= # e.g. ghcr.io/username, docker.io/username, 123456789.dkr.ecr.us-east-1.amazonaws.com
PLATFORMS  ?= linux/amd64,linux/arm64
BUILDER    ?= portfolio-comparator-builder
VITE_AUTH_TOKEN ?= # set to match AUTH_TOKEN for frontend auth

FULL_IMAGE = $(if $(REGISTRY),$(REGISTRY)/$(IMAGE_NAME),$(IMAGE_NAME)):$(IMAGE_TAG)
VERSION_IMAGE = $(if $(REGISTRY),$(REGISTRY)/$(IMAGE_NAME),$(IMAGE_NAME)):$(VERSION)

TAG_FLAGS = -t $(FULL_IMAGE) $(if $(VERSION),-t $(VERSION_IMAGE),)
BUILD_ARGS = $(if $(VITE_AUTH_TOKEN),--build-arg VITE_AUTH_TOKEN=$(VITE_AUTH_TOKEN),)

.PHONY: buildx-setup build build-local push release

buildx-setup:
	@docker buildx inspect $(BUILDER) >/dev/null 2>&1 || docker buildx create --name $(BUILDER) --driver docker-container

build: buildx-setup
	docker buildx build --builder $(BUILDER) --platform $(PLATFORMS) $(BUILD_ARGS) $(TAG_FLAGS) .

build-local:
	docker buildx build --load $(BUILD_ARGS) $(TAG_FLAGS) .

push: buildx-setup
	docker buildx build --builder $(BUILDER) --platform $(PLATFORMS) $(BUILD_ARGS) $(TAG_FLAGS) --push .

release: push
